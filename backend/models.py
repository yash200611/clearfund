from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field
from bson import ObjectId


class PyObjectId(str):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return str(v)


class Role(str, Enum):
    donor = "donor"
    ngo = "ngo"
    admin = "admin"


class CampaignStatus(str, Enum):
    draft = "draft"
    active = "active"
    completed = "completed"
    failed = "failed"


class MilestoneStatus(str, Enum):
    pending = "pending"
    submitted = "submitted"
    approved = "approved"
    rejected = "rejected"
    released = "released"


class User(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    auth0_sub: str
    email: str
    role: Role = Role.donor
    privy_wallet_id: Optional[str] = None
    wallet_address: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class Campaign(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    ngo_id: str
    title: str
    description: str
    category: str
    total_raised_sol: float = 0.0
    vault_address: Optional[str] = None
    status: CampaignStatus = CampaignStatus.draft
    trust_score: float = 0.0
    failure_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class Milestone(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    campaign_id: str
    title: str
    description: str
    amount_sol: float
    due_date: datetime
    status: MilestoneStatus = MilestoneStatus.pending
    evidence_urls: List[str] = []
    ai_decision: Dict[str, Any] = {}
    oracle_result: Dict[str, Any] = {}
    solana_tx: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class Donation(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    donor_id: str
    campaign_id: str
    amount_sol: float
    wallet_address: str
    solana_tx: str
    released_sol: float = 0.0
    locked_sol: float = 0.0
    refunded_sol: float = 0.0
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class AgentAuditLog(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    milestone_id: str
    event_type: str
    payload: Dict[str, Any] = {}
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


# Request bodies
class CreateCampaignRequest(BaseModel):
    title: str
    description: str
    category: str
    vault_address: Optional[str] = None


class CreateMilestoneRequest(BaseModel):
    title: str
    description: str
    amount_sol: float
    due_date: datetime


class SubmitEvidenceRequest(BaseModel):
    description: str
    evidence_urls: List[str] = []


class CreateDonationRequest(BaseModel):
    campaign_id: str
    amount_sol: float
    solana_tx: str
    wallet_address: str
