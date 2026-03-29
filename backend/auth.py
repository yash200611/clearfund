import os
from functools import lru_cache
from typing import Optional
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

load_dotenv()

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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AUTH0_DOMAIN is not configured",
        )
    url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
    try:
        response = httpx.get(url, timeout=10)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as e:
        print(f"[Auth] JWKS HTTP error: status={e.response.status_code} url={url}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to fetch Auth0 JWKS (status {e.response.status_code})",
        )
    except httpx.RequestError as e:
        print(f"[Auth] JWKS request error: {e.__class__.__name__}: {e} url={url}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to fetch Auth0 JWKS",
        )


def decode_token(token: str) -> dict:
    try:
        jwks = get_jwks()
        unverified_header = jwt.get_unverified_header(token)
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
        return payload

    except HTTPException:
        raise
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {str(e)}",
        )
    except Exception:
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
    payload = decode_token(token)
    sub = payload.get("sub")
    email = payload.get("email", "")
    role = payload.get(ROLE_CLAIM, "donor")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
        )
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
