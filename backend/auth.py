import os
import hashlib
import logging
from functools import lru_cache
from typing import Optional
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

load_dotenv()
logger = logging.getLogger("clearfund.auth")


def _mask(value: Optional[str], keep: int = 6) -> str:
    if not value:
        return ""
    if len(value) <= keep:
        return value
    return f"{value[:keep]}…"


def _fingerprint(value: Optional[str]) -> str:
    if not value:
        return ""
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:12]


def _normalize_auth0_domain(raw: str) -> str:
    """
    Accepts:
    - dev-xxx.us.auth0.com
    - https://dev-xxx.us.auth0.com
    - https://dev-xxx.us.auth0.com/.well-known/jwks.json
    and always returns host only.
    """
    value = (raw or "").strip().strip('"').strip("'")
    if not value:
        return ""

    parsed = urlparse(value if "://" in value else f"https://{value}")
    host = parsed.netloc or parsed.path
    return host.split("/")[0].strip().lower()


AUTH0_DOMAIN = _normalize_auth0_domain(os.getenv("AUTH0_DOMAIN", ""))
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE", "")
ALGORITHMS = ["RS256"]
ROLE_CLAIM = "https://clearfund.app/role"

security = HTTPBearer()


@lru_cache(maxsize=1)
def get_jwks() -> dict:
    if not AUTH0_DOMAIN:
        logger.error("[Auth] AUTH0_DOMAIN is missing")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AUTH0_DOMAIN is not configured",
        )
    url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
    logger.info("[Auth] Fetching JWKS url=%s domain=%s", url, AUTH0_DOMAIN)
    try:
        response = httpx.get(url, timeout=10)
        response.raise_for_status()
        payload = response.json()
        keys = payload.get("keys", [])
        logger.info("[Auth] JWKS fetch success status=%s key_count=%s", response.status_code, len(keys))
        return payload
    except httpx.HTTPStatusError as e:
        logger.error(
            "[Auth] JWKS HTTP error status=%s url=%s body=%s",
            e.response.status_code,
            url,
            _mask(e.response.text, keep=180),
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to fetch Auth0 JWKS (status {e.response.status_code})",
        )
    except httpx.RequestError as e:
        logger.error("[Auth] JWKS request error type=%s url=%s error=%s", e.__class__.__name__, url, str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to fetch Auth0 JWKS",
        )
    except Exception as e:
        logger.exception("[Auth] Unexpected JWKS fetch error url=%s error=%s", url, str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to fetch Auth0 JWKS",
        )


def decode_token(token: str) -> dict:
    try:
        jwks = get_jwks()
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        logger.info(
            "[Auth] Decoding token kid=%s alg=%s expected_audience=%s expected_issuer=%s",
            kid,
            unverified_header.get("alg"),
            AUTH0_AUDIENCE,
            f"https://{AUTH0_DOMAIN}/",
        )
        rsa_key = {}
        for key in jwks["keys"]:
            if key["kid"] == unverified_header.get("kid"):
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"],
                }
                break

        if not rsa_key:
            logger.warning("[Auth] No matching JWKS key for kid=%s", kid)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unable to find matching JWKS key",
            )

        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=ALGORITHMS,
            audience=AUTH0_AUDIENCE,
            issuer=f"https://{AUTH0_DOMAIN}/",
        )
        logger.info(
            "[Auth] Token decoded sub=%s email=%s role_claim=%s aud=%s iss=%s",
            payload.get("sub"),
            payload.get("email"),
            payload.get(ROLE_CLAIM),
            payload.get("aud"),
            payload.get("iss"),
        )
        return payload

    except HTTPException:
        raise
    except JWTError as e:
        logger.warning("[Auth] JWT validation failed: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {str(e)}",
        )
    except Exception as e:
        logger.exception("[Auth] Unexpected token validation error: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token validation failed",
        )


class TokenData:
    def __init__(self, sub: str, email: str, role: str):
        self.sub = sub
        self.email = email
        self.role = role


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> TokenData:
    token = credentials.credentials
    logger.info(
        "[Auth] get_current_user auth_scheme=%s token_len=%s token_fp=%s",
        credentials.scheme,
        len(token) if token else 0,
        _fingerprint(token),
    )
    payload = decode_token(token)
    sub = payload.get("sub")
    email = payload.get("email", "")
    role = payload.get(ROLE_CLAIM, "donor")
    if not sub:
        logger.warning("[Auth] Token missing sub claim payload_keys=%s", list(payload.keys()))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
        )
    logger.info("[Auth] Authenticated sub=%s role=%s email=%s", sub, role, email)
    return TokenData(sub=sub, email=email, role=role)


async def require_donor(user: TokenData = Depends(get_current_user)) -> TokenData:
    if user.role not in ("donor", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Donor access required",
        )
    return user


async def require_ngo(user: TokenData = Depends(get_current_user)) -> TokenData:
    if user.role not in ("ngo", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="NGO access required",
        )
    return user


async def require_verifier(user: TokenData = Depends(get_current_user)) -> TokenData:
    if user.role not in ("verifier", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verifier access required",
        )
    return user


async def require_admin(user: TokenData = Depends(get_current_user)) -> TokenData:
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user
