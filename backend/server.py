from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Form, Depends
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import aiofiles
import pandas as pd
from io import BytesIO, StringIO
import csv
import boto3
from botocore.exceptions import ClientError
from passlib.context import CryptContext
from jose import JWTError, jwt
import httpx
import base64
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# OCR.space API Key
OCR_SPACE_API_KEY = os.environ.get('OCR_SPACE_API_KEY', '')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'passport-control-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security
security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Validate JWT token and return current user"""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def get_admin_user(current_user: dict = Depends(get_current_user)):
    """Check if current user is admin"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# AWS S3 Configuration
AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')
S3_BUCKET_NAME = os.environ.get('S3_BUCKET_NAME', 'passport-control-uploads')

# Initialize S3 client
s3_client = None
s3_enabled = False

def init_s3():
    """Initialize S3 client and create bucket if needed"""
    global s3_client, s3_enabled
    
    if not AWS_ACCESS_KEY_ID or not AWS_SECRET_ACCESS_KEY:
        logging.info("AWS credentials not configured, using local storage")
        return False
    
    try:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_REGION
        )
        
        # Check if bucket exists
        try:
            s3_client.head_bucket(Bucket=S3_BUCKET_NAME)
            logging.info(f"S3 bucket {S3_BUCKET_NAME} exists")
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', '')
            if error_code == '404' or error_code == 'NoSuchBucket':
                # Create bucket
                try:
                    if AWS_REGION == 'us-east-1':
                        s3_client.create_bucket(Bucket=S3_BUCKET_NAME)
                    else:
                        s3_client.create_bucket(
                            Bucket=S3_BUCKET_NAME,
                            CreateBucketConfiguration={'LocationConstraint': AWS_REGION}
                        )
                    logging.info(f"Created S3 bucket {S3_BUCKET_NAME}")
                except Exception as create_err:
                    logging.error(f"Failed to create bucket: {create_err}")
                    return False
            else:
                logging.error(f"Error checking bucket: {e}")
                return False
        
        s3_enabled = True
        logging.info("S3 storage enabled")
        return True
        
    except Exception as e:
        logging.error(f"S3 initialization failed: {e}")
        return False

# Try to initialize S3 (non-blocking)
try:
    init_s3()
except Exception as e:
    logging.warning(f"S3 init skipped: {e}")

# Create local uploads directory (fallback)
UPLOADS_DIR = ROOT_DIR / 'uploads'
PASSPORT_UPLOADS = UPLOADS_DIR / 'passports'
PHOTO_UPLOADS = UPLOADS_DIR / 'photos'
PASSPORT_UPLOADS.mkdir(parents=True, exist_ok=True)
PHOTO_UPLOADS.mkdir(parents=True, exist_ok=True)

# Allowed file extensions
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg'}
EXCEL_EXTENSIONS = {'.xlsx', '.xls', '.csv'}

app = FastAPI()
api_router = APIRouter(prefix="/api")

# S3 Helper Functions
async def upload_to_s3(file_content: bytes, s3_key: str, content_type: str = 'image/jpeg') -> bool:
    """Upload file to S3 bucket"""
    if not s3_enabled or not s3_client:
        return False
    try:
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=s3_key,
            Body=file_content,
            ContentType=content_type
        )
        logging.info(f"Uploaded to S3: {s3_key}")
        return True
    except Exception as e:
        logging.error(f"S3 upload error: {e}")
        return False

def generate_presigned_url(s3_key: str, expiration: int = 3600) -> str:
    """Generate a pre-signed URL for S3 object (valid for 1 hour by default)"""
    if not s3_enabled or not s3_client or not s3_key:
        return None
    try:
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_BUCKET_NAME, 'Key': s3_key},
            ExpiresIn=expiration
        )
        return url
    except Exception as e:
        logging.error(f"Presigned URL error: {e}")
        return None

def delete_from_s3(s3_key: str) -> bool:
    """Delete file from S3 bucket"""
    if not s3_enabled or not s3_client or not s3_key:
        return False
    try:
        s3_client.delete_object(Bucket=S3_BUCKET_NAME, Key=s3_key)
        logging.info(f"Deleted from S3: {s3_key}")
        return True
    except Exception as e:
        logging.error(f"S3 delete error: {e}")
        return False

# Models
class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    client_id: Optional[str] = None  # Link to client

class GroupSubmissionDetails(BaseModel):
    approval_number: Optional[str] = None
    date_of_payment: Optional[str] = None

class Group(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    client_id: Optional[str] = None  # Link to client
    client_name: Optional[str] = None  # Client name (populated dynamically)
    passport_count: int = 0
    approval_number: Optional[str] = None  # Approval number for e-visa submission
    date_of_payment: Optional[str] = None  # Date of payment for e-visa submission
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PassportCreate(BaseModel):
    passport_no: str
    passport_type: Optional[str] = None
    first_name_en: str
    surname_en: str
    first_name_ar: Optional[str] = None
    father_name_ar: Optional[str] = None
    father_name_en: Optional[str] = None
    grandfather_name_ar: Optional[str] = None
    grandfather_name_en: Optional[str] = None
    surname_ar: Optional[str] = None
    mother_name_ar: Optional[str] = None
    mother_name_en: Optional[str] = None
    mother_father_name_ar: Optional[str] = None
    mother_father_name_en: Optional[str] = None
    nationality: str
    gender: Optional[str] = None
    birth_date: Optional[str] = None
    place_of_issue: Optional[str] = None
    issue_date: Optional[str] = None
    expiry_date: str
    profession: Optional[str] = None
    country_of_residence: Optional[str] = None
    applicant_type: Optional[str] = None
    relationship_proof: Optional[str] = None  # S3 URL for relationship proof (required for minors)

class Passport(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    group_id: str
    passport_no: str
    passport_type: Optional[str] = None
    first_name_en: str = ""
    surname_en: str = ""
    first_name_ar: Optional[str] = None
    father_name_ar: Optional[str] = None
    father_name_en: Optional[str] = None
    grandfather_name_ar: Optional[str] = None
    grandfather_name_en: Optional[str] = None
    surname_ar: Optional[str] = None
    mother_name_ar: Optional[str] = None
    mother_name_en: Optional[str] = None
    mother_father_name_ar: Optional[str] = None
    mother_father_name_en: Optional[str] = None
    nationality: str = ""
    gender: Optional[str] = None
    birth_date: Optional[str] = None
    place_of_issue: Optional[str] = None
    issue_date: Optional[str] = None
    expiry_date: str = ""
    profession: Optional[str] = None
    country_of_residence: Optional[str] = None
    applicant_type: Optional[str] = None
    relationship_proof: Optional[str] = None  # S3 URL for relationship proof (required for minors)
    passport_image: Optional[str] = None
    profile_image: Optional[str] = None
    status: str = "pending"  # pending, done
    status_updated_at: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PassportUpdate(BaseModel):
    passport_no: Optional[str] = None
    passport_type: Optional[str] = None
    first_name_en: Optional[str] = None
    surname_en: Optional[str] = None
    first_name_ar: Optional[str] = None
    father_name_ar: Optional[str] = None
    father_name_en: Optional[str] = None
    grandfather_name_ar: Optional[str] = None
    grandfather_name_en: Optional[str] = None
    surname_ar: Optional[str] = None
    mother_name_ar: Optional[str] = None
    mother_name_en: Optional[str] = None
    mother_father_name_ar: Optional[str] = None
    mother_father_name_en: Optional[str] = None
    nationality: Optional[str] = None
    gender: Optional[str] = None
    birth_date: Optional[str] = None
    place_of_issue: Optional[str] = None
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    profession: Optional[str] = None
    country_of_residence: Optional[str] = None
    applicant_type: Optional[str] = None
    relationship_proof: Optional[str] = None  # S3 URL for relationship proof
    status: Optional[str] = None

# Helper function to calculate age from birth_date
def calculate_age(birth_date_str: str) -> int:
    """Calculate age from birth date string (YYYY-MM-DD format)"""
    if not birth_date_str:
        return 99  # Default to adult if no birth date
    try:
        # Handle various date formats
        if '-' in birth_date_str:
            birth_date = datetime.strptime(birth_date_str.split('T')[0], '%Y-%m-%d')
        elif '/' in birth_date_str:
            parts = birth_date_str.split('/')
            if len(parts[2]) == 4:  # m/d/yyyy
                birth_date = datetime.strptime(birth_date_str, '%m/%d/%Y')
            else:  # m/d/yy
                birth_date = datetime.strptime(birth_date_str, '%m/%d/%y')
        else:
            return 99
        
        today = datetime.now()
        age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
        return age
    except Exception as e:
        logging.warning(f"Could not parse birth date '{birth_date_str}': {e}")
        return 99  # Default to adult on error

def is_minor(birth_date_str: str) -> bool:
    """Check if person is under 18 years old"""
    return calculate_age(birth_date_str) < 18

def get_applicant_type(birth_date_str: str, gender: str) -> str:
    """Get applicant type based on age and gender"""
    if not is_minor(birth_date_str):
        return ""  # Empty for adults
    
    gender_lower = (gender or "").lower()
    if gender_lower in ["male", "m"]:
        return "Son"
    elif gender_lower in ["female", "f"]:
        return "Daughter"
    return ""  # Default to empty if gender unknown

# ============ USER MODELS ============
class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    role: str = "staff"  # "admin" or "staff"

class UserUpdate(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    role: str = "staff"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

# ============ CLIENT MODELS ============
class ClientCreate(BaseModel):
    name: str
    company_name: Optional[str] = ""
    contact_person_name: Optional[str] = ""
    contact_person_no: Optional[str] = ""
    email: Optional[str] = ""
    mobile_no: Optional[str] = ""
    address: Optional[str] = ""
    country: Optional[str] = ""

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    company_name: Optional[str] = None
    contact_person_name: Optional[str] = None
    contact_person_no: Optional[str] = None
    email: Optional[str] = None
    mobile_no: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None

class Client(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    company_name: str = ""
    contact_person_name: str = ""
    contact_person_no: str = ""
    email: str = ""
    mobile_no: str = ""
    address: str = ""
    country: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

def validate_file_extension(filename: str) -> bool:
    ext = Path(filename).suffix.lower()
    return ext in ALLOWED_EXTENSIONS

def validate_excel_extension(filename: str) -> bool:
    ext = Path(filename).suffix.lower()
    return ext in EXCEL_EXTENSIONS

def extract_passport_number(filename: str) -> str:
    """Extract passport number from filename (without extension)
    Handles common suffixes like PP, PIC, PHOTO, SCAN, etc.
    """
    stem = Path(filename).stem.upper()
    
    # Remove common suffixes that users might add to filenames
    suffixes_to_remove = ['PP', 'PIC', 'PHOTO', 'SCAN', 'IMG', 'IMAGE', 'PASSPORT', 'PROFILE', '_PP', '_PIC', '_PHOTO', '_SCAN', '-PP', '-PIC', '-PHOTO', '-SCAN']
    
    for suffix in suffixes_to_remove:
        if stem.endswith(suffix):
            stem = stem[:-len(suffix)]
            break
    
    # Also remove any trailing underscores or dashes
    stem = stem.rstrip('_-')
    
    return stem

# Group endpoints
@api_router.get("/groups", response_model=List[Group])
async def get_groups(client_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if client_id:
        query["client_id"] = client_id
    
    groups = await db.groups.find(query, {"_id": 0}).to_list(1000)
    
    # Add client name for each group
    for group in groups:
        if group.get("client_id"):
            client = await db.clients.find_one({"id": group["client_id"]}, {"_id": 0, "name": 1})
            group["client_name"] = client["name"] if client else "Unknown"
        else:
            group["client_name"] = None
    
    return groups

@api_router.post("/groups", response_model=Group)
async def create_group(group_data: GroupCreate, current_user: dict = Depends(get_current_user)):
    # Validate client_id if provided
    if group_data.client_id:
        client = await db.clients.find_one({"id": group_data.client_id})
        if not client:
            raise HTTPException(status_code=400, detail="Client not found")
    
    group = Group(**group_data.model_dump())
    doc = group.model_dump()
    await db.groups.insert_one(doc)
    return group

@api_router.get("/groups/{group_id}", response_model=Group)
async def get_group(group_id: str, current_user: dict = Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Add client name
    if group.get("client_id"):
        client = await db.clients.find_one({"id": group["client_id"]}, {"_id": 0, "name": 1})
        group["client_name"] = client["name"] if client else "Unknown"
    else:
        group["client_name"] = None
    
    return group

@api_router.put("/groups/{group_id}", response_model=Group)
async def update_group(group_id: str, group_data: GroupCreate, current_user: dict = Depends(get_current_user)):
    # Validate client_id if provided
    if group_data.client_id:
        client = await db.clients.find_one({"id": group_data.client_id})
        if not client:
            raise HTTPException(status_code=400, detail="Client not found")
    
    result = await db.groups.update_one(
        {"id": group_id},
        {"$set": group_data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Group not found")
    
    group = await db.groups.find_one({"id": group_id}, {"_id": 0})
    
    # Add client name
    if group.get("client_id"):
        client = await db.clients.find_one({"id": group["client_id"]}, {"_id": 0, "name": 1})
        group["client_name"] = client["name"] if client else "Unknown"
    else:
        group["client_name"] = None
    
    return group

@api_router.put("/groups/{group_id}/submission-details", response_model=Group)
async def update_group_submission_details(
    group_id: str, 
    submission_data: GroupSubmissionDetails, 
    current_user: dict = Depends(get_current_user)
):
    """Update approval number and date of payment for a group"""
    # Check if group exists
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Build update dict with only non-None values
    update_data = {}
    if submission_data.approval_number is not None:
        update_data["approval_number"] = submission_data.approval_number
    if submission_data.date_of_payment is not None:
        update_data["date_of_payment"] = submission_data.date_of_payment
    
    if update_data:
        await db.groups.update_one(
            {"id": group_id},
            {"$set": update_data}
        )
    
    # Fetch and return updated group
    group = await db.groups.find_one({"id": group_id}, {"_id": 0})
    
    # Add client name
    if group.get("client_id"):
        client = await db.clients.find_one({"id": group["client_id"]}, {"_id": 0, "name": 1})
        group["client_name"] = client["name"] if client else "Unknown"
    else:
        group["client_name"] = None
    
    return group

@api_router.delete("/groups/{group_id}")
async def delete_group(group_id: str, current_user: dict = Depends(get_current_user)):
    await db.passports.delete_many({"group_id": group_id})
    result = await db.groups.delete_one({"id": group_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Group not found")
    return {"message": "Group deleted successfully"}

# Helper function to process passport images (convert S3 keys to presigned URLs)
def process_passport_images(passport: dict) -> dict:
    """Convert S3 keys to presigned URLs for passport images"""
    if passport.get('passport_image') and passport['passport_image'].startswith('s3://'):
        s3_key = passport['passport_image'][5:]  # Remove 's3://' prefix
        presigned_url = generate_presigned_url(s3_key)
        passport['passport_image'] = presigned_url or passport['passport_image']
    
    if passport.get('profile_image') and passport['profile_image'].startswith('s3://'):
        s3_key = passport['profile_image'][5:]  # Remove 's3://' prefix
        presigned_url = generate_presigned_url(s3_key)
        passport['profile_image'] = presigned_url or passport['profile_image']
    
    return passport

# Passport endpoints
@api_router.get("/groups/{group_id}/passports", response_model=List[Passport])
async def get_passports(group_id: str, current_user: dict = Depends(get_current_user)):
    passports = await db.passports.find({"group_id": group_id}, {"_id": 0}).to_list(1000)
    # Process S3 images to presigned URLs
    processed_passports = [process_passport_images(p) for p in passports]
    return processed_passports

@api_router.post("/groups/{group_id}/passports", response_model=Passport)
async def create_passport(group_id: str, passport_data: PassportCreate, current_user: dict = Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    existing = await db.passports.find_one({
        "group_id": group_id,
        "passport_no": passport_data.passport_no.upper()
    })
    if existing:
        raise HTTPException(status_code=400, detail="Passport number already exists in this group")
    
    passport_dict = passport_data.model_dump()
    passport_dict["passport_no"] = passport_dict["passport_no"].upper()
    passport = Passport(group_id=group_id, **passport_dict)
    
    # Check if images already exist
    passport_img = PASSPORT_UPLOADS / group_id / f"{passport.passport_no}.jpg"
    photo_img = PHOTO_UPLOADS / group_id / f"{passport.passport_no}.jpg"
    
    if passport_img.exists():
        passport.passport_image = f"/api/uploads/passports/{group_id}/{passport.passport_no}.jpg"
    if photo_img.exists():
        passport.profile_image = f"/api/uploads/photos/{group_id}/{passport.passport_no}.jpg"
    
    doc = passport.model_dump()
    await db.passports.insert_one(doc)
    
    await db.groups.update_one(
        {"id": group_id},
        {"$inc": {"passport_count": 1}}
    )
    
    return passport

@api_router.get("/groups/{group_id}/passports/{passport_id}", response_model=Passport)
async def get_passport(group_id: str, passport_id: str, current_user: dict = Depends(get_current_user)):
    passport = await db.passports.find_one({"id": passport_id, "group_id": group_id}, {"_id": 0})
    if not passport:
        raise HTTPException(status_code=404, detail="Passport not found")
    # Process S3 images to presigned URLs
    return process_passport_images(passport)

@api_router.put("/groups/{group_id}/passports/{passport_id}", response_model=Passport)
async def update_passport(group_id: str, passport_id: str, passport_data: PassportUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in passport_data.model_dump().items() if v is not None}
    if "passport_no" in update_data:
        update_data["passport_no"] = update_data["passport_no"].upper()
    
    if not update_data:
        passport = await db.passports.find_one({"id": passport_id}, {"_id": 0})
        return process_passport_images(passport)
    
    result = await db.passports.update_one(
        {"id": passport_id, "group_id": group_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Passport not found")
    passport = await db.passports.find_one({"id": passport_id}, {"_id": 0})
    return process_passport_images(passport)

@api_router.delete("/groups/{group_id}/passports/{passport_id}")
async def delete_passport(group_id: str, passport_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.passports.delete_one({"id": passport_id, "group_id": group_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Passport not found")
    
    await db.groups.update_one(
        {"id": group_id},
        {"$inc": {"passport_count": -1}}
    )
    
    return {"message": "Passport deleted successfully"}

# Status update endpoint
@api_router.put("/passports/{passport_id}/status")
async def update_passport_status(passport_id: str, status: str, current_user: dict = Depends(get_current_user)):
    """Update passport processing status (pending/done)"""
    if status not in ["pending", "done"]:
        raise HTTPException(status_code=400, detail="Invalid status. Use 'pending' or 'done'")
    
    update_data = {
        "status": status,
        "status_updated_at": datetime.now(timezone.utc).isoformat() if status == "done" else None
    }
    
    result = await db.passports.update_one(
        {"id": passport_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Passport not found")
    
    passport = await db.passports.find_one({"id": passport_id}, {"_id": 0})
    return process_passport_images(passport)

# Bulk status update endpoint
@api_router.put("/groups/{group_id}/passports/bulk-status")
async def bulk_update_passport_status(group_id: str, passport_ids: List[str], status: str, current_user: dict = Depends(get_current_user)):
    """Bulk update passport processing status"""
    if status not in ["pending", "done"]:
        raise HTTPException(status_code=400, detail="Invalid status. Use 'pending' or 'done'")
    
    update_data = {
        "status": status,
        "status_updated_at": datetime.now(timezone.utc).isoformat() if status == "done" else None
    }
    
    result = await db.passports.update_many(
        {"id": {"$in": passport_ids}, "group_id": group_id},
        {"$set": update_data}
    )
    
    return {"updated": result.modified_count}


# Get group stats endpoint
@api_router.get("/groups/{group_id}/stats")
async def get_group_stats(group_id: str):
    """Get passport processing stats for a group"""
    total = await db.passports.count_documents({"group_id": group_id})
    done = await db.passports.count_documents({"group_id": group_id, "status": "done"})
    pending = total - done
    
    return {
        "total": total,
        "done": done,
        "pending": pending,
        "progress_percent": round((done / total * 100) if total > 0 else 0, 1)
    }

# CSV Export endpoint
@api_router.get("/groups/{group_id}/export/csv")
async def export_passports_csv(group_id: str):
    group = await db.groups.find_one({"id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    passports = await db.passports.find({"group_id": group_id}, {"_id": 0}).to_list(1000)
    
    if not passports:
        raise HTTPException(status_code=404, detail="No passports found in this group")
    
    # Create CSV
    output = StringIO()
    fieldnames = [
        'passport_no', 'passport_type', 'first_name_en', 'surname_en', 
        'father_name_en', 'grandfather_name_en', 'first_name_ar', 'surname_ar',
        'father_name_ar', 'grandfather_name_ar', 'mother_name_ar', 'mother_name_en',
        'mother_father_name_ar', 'mother_father_name_en', 'nationality', 'gender',
        'birth_date', 'place_of_issue', 'issue_date', 'expiry_date', 'profession',
        'country_of_residence', 'applicant_type', 'status', 'status_updated_at',
        'passport_image', 'profile_image'
    ]
    
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    
    for p in passports:
        row = {field: p.get(field, '') for field in fieldnames}
        writer.writerow(row)
    
    output.seek(0)
    
    filename = f"{group['name'].replace(' ', '_')}_passports.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# Excel/CSV bulk import endpoint
@api_router.post("/groups/{group_id}/import/excel")
async def bulk_import_excel(group_id: str, file: UploadFile = File(...)):
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if not validate_excel_extension(file.filename):
        raise HTTPException(status_code=400, detail="Invalid file type. Only Excel (.xlsx, .xls) or CSV files allowed.")
    
    content = await file.read()
    
    try:
        ext = Path(file.filename).suffix.lower()
        if ext == '.csv':
            df = pd.read_csv(BytesIO(content))
        else:
            df = pd.read_excel(BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")
    
    # Normalize column names
    df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_')
    
    # Map common column name variations
    column_mapping = {
        'passport_number': 'passport_no',
        'passportno': 'passport_no',
        'passport': 'passport_no',
        'first_name': 'first_name_en',
        'firstname': 'first_name_en',
        'name': 'first_name_en',
        'surname': 'surname_en',
        'last_name': 'surname_en',
        'lastname': 'surname_en',
        'family_name': 'surname_en',
        'father': 'father_name_en',
        'father_name': 'father_name_en',
        'grandfather': 'grandfather_name_en',
        'grandfather_name': 'grandfather_name_en',
        'mother_name': 'mother_name_en',
        'mother': 'mother_name_en',
        'mother_father': 'mother_father_name_en',
        'mothers_father': 'mother_father_name_en',
        'expiry': 'expiry_date',
        'expire_date': 'expiry_date',
        'valid_until': 'expiry_date',
        'issue': 'issue_date',
        'issued_date': 'issue_date',
        'dob': 'birth_date',
        'date_of_birth': 'birth_date',
        'birthday': 'birth_date',
        'country': 'nationality',
        'sex': 'gender',
        'job': 'profession',
        'occupation': 'profession',
        'type': 'passport_type',
        'place_issued': 'place_of_issue',
        'issued_place': 'place_of_issue',
        'issue_place': 'place_of_issue',
        'residence': 'country_of_residence',
        'residence_country': 'country_of_residence',
        'applicant': 'applicant_type',
    }
    
    df.rename(columns=column_mapping, inplace=True)
    
    results = {"success": [], "failed": [], "skipped": []}
    
    for index, row in df.iterrows():
        try:
            # Get passport number - required field
            passport_no = None
            if 'passport_no' in row and pd.notna(row['passport_no']):
                passport_no = str(row['passport_no']).strip().upper()
            
            if not passport_no:
                results["failed"].append({
                    "row": index + 2,
                    "reason": "Missing passport number"
                })
                continue
            
            # Check if passport already exists
            existing = await db.passports.find_one({
                "group_id": group_id,
                "passport_no": passport_no
            })
            
            if existing:
                results["skipped"].append({
                    "row": index + 2,
                    "passport_no": passport_no,
                    "reason": "Passport already exists"
                })
                continue
            
            # Build passport data
            passport_data = {
                "id": str(uuid.uuid4()),
                "group_id": group_id,
                "passport_no": passport_no,
                "passport_type": str(row.get('passport_type', 'Normal')) if pd.notna(row.get('passport_type')) else "Normal",
                "first_name_en": str(row.get('first_name_en', '')) if pd.notna(row.get('first_name_en')) else "",
                "surname_en": str(row.get('surname_en', '')) if pd.notna(row.get('surname_en')) else "",
                "father_name_en": str(row.get('father_name_en', '')) if pd.notna(row.get('father_name_en')) else "",
                "grandfather_name_en": str(row.get('grandfather_name_en', '')) if pd.notna(row.get('grandfather_name_en')) else "",
                "first_name_ar": str(row.get('first_name_ar', '')) if pd.notna(row.get('first_name_ar')) else "",
                "surname_ar": str(row.get('surname_ar', '')) if pd.notna(row.get('surname_ar')) else "",
                "father_name_ar": str(row.get('father_name_ar', '')) if pd.notna(row.get('father_name_ar')) else "",
                "grandfather_name_ar": str(row.get('grandfather_name_ar', '')) if pd.notna(row.get('grandfather_name_ar')) else "",
                "mother_name_ar": str(row.get('mother_name_ar', '')) if pd.notna(row.get('mother_name_ar')) else "",
                "mother_name_en": str(row.get('mother_name_en', '')) if pd.notna(row.get('mother_name_en')) else "",
                "mother_father_name_ar": str(row.get('mother_father_name_ar', '')) if pd.notna(row.get('mother_father_name_ar')) else "",
                "mother_father_name_en": str(row.get('mother_father_name_en', '')) if pd.notna(row.get('mother_father_name_en')) else "",
                "nationality": str(row.get('nationality', '')) if pd.notna(row.get('nationality')) else "",
                "gender": str(row.get('gender', '')) if pd.notna(row.get('gender')) else "",
                "birth_date": str(row.get('birth_date', '')) if pd.notna(row.get('birth_date')) else "",
                "place_of_issue": str(row.get('place_of_issue', '')) if pd.notna(row.get('place_of_issue')) else "",
                "issue_date": str(row.get('issue_date', '')) if pd.notna(row.get('issue_date')) else "",
                "expiry_date": str(row.get('expiry_date', '')) if pd.notna(row.get('expiry_date')) else "",
                "profession": str(row.get('profession', '')) if pd.notna(row.get('profession')) else "",
                "country_of_residence": str(row.get('country_of_residence', '')) if pd.notna(row.get('country_of_residence')) else "",
                "applicant_type": str(row.get('applicant_type', '')) if pd.notna(row.get('applicant_type')) else "",
                "passport_image": None,
                "profile_image": None,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Check if images already exist for this passport number
            passport_img = PASSPORT_UPLOADS / group_id / f"{passport_no}.jpg"
            photo_img = PHOTO_UPLOADS / group_id / f"{passport_no}.jpg"
            
            if passport_img.exists():
                passport_data["passport_image"] = f"/api/uploads/passports/{group_id}/{passport_no}.jpg"
            if photo_img.exists():
                passport_data["profile_image"] = f"/api/uploads/photos/{group_id}/{passport_no}.jpg"
            
            await db.passports.insert_one(passport_data)
            results["success"].append({
                "row": index + 2,
                "passport_no": passport_no,
                "name": f"{passport_data['first_name_en']} {passport_data['surname_en']}"
            })
            
        except Exception as e:
            results["failed"].append({
                "row": index + 2,
                "reason": str(e)
            })
    
    # Update group passport count
    if results["success"]:
        await db.groups.update_one(
            {"id": group_id},
            {"$inc": {"passport_count": len(results["success"])}}
        )
    
    return results

# Download sample Excel template
@api_router.get("/templates/passport-import")
async def get_import_template():
    # Create sample Excel template with e-visa compatible values
    df = pd.DataFrame({
        'passport_no': ['AB1234567', 'CD7654321'],
        'passport_type': ['Normal', 'Diplomatic'],
        'first_name_en': ['John', 'Jane'],
        'surname_en': ['Doe', 'Smith'],
        'father_name_en': ['Michael', 'Robert'],
        'grandfather_name_en': ['James', 'William'],
        'first_name_ar': ['جون', 'جين'],
        'surname_ar': ['دو', 'سميث'],
        'father_name_ar': ['مايكل', 'روبرت'],
        'grandfather_name_ar': ['جيمس', 'وليام'],
        'mother_name_ar': ['سارة', 'ماري'],
        'mother_name_en': ['Sarah', 'Mary'],
        'mother_father_name_ar': ['أحمد', 'ديفيد'],
        'mother_father_name_en': ['Ahmed', 'David'],
        'nationality': ['American', 'British'],
        'gender': ['Male', 'Female'],
        'birth_date': ['1990-01-15', '1985-06-20'],
        'place_of_issue': ['United States of America', 'United Kingdom of Great Britain'],
        'issue_date': ['2020-01-01', '2019-06-15'],
        'expiry_date': ['2030-01-01', '2029-06-15'],
        'profession': ['Engineer', 'Physician'],
        'country_of_residence': ['United States of America', 'United Kingdom of Great Britain'],
        'applicant_type': ['', 'Son']
    })
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Passports')
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=passport_import_template.xlsx"}
    )

# Bulk upload endpoints
@api_router.post("/groups/{group_id}/upload/passports")
async def bulk_upload_passports(group_id: str, files: List[UploadFile] = File(...)):
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    results = {"success": [], "failed": [], "mapped": []}
    
    for file in files:
        if not validate_file_extension(file.filename):
            results["failed"].append({"filename": file.filename, "reason": "Invalid file type. Only JPG/JPEG allowed."})
            continue
        
        passport_no = extract_passport_number(file.filename)
        content = await file.read()
        
        try:
            if s3_enabled and s3_client:
                # Upload to S3
                s3_key = f"passports/{group_id}/{passport_no}.jpg"
                uploaded = await upload_to_s3(content, s3_key, 'image/jpeg')
                if uploaded:
                    results["success"].append({"filename": file.filename, "passport_no": passport_no})
                    # Store S3 key in database (not full URL - we generate presigned URLs on demand)
                    update_result = await db.passports.update_one(
                        {"group_id": group_id, "passport_no": passport_no},
                        {"$set": {"passport_image": f"s3://{s3_key}"}}
                    )
                    if update_result.matched_count > 0:
                        results["mapped"].append(passport_no)
                else:
                    results["failed"].append({"filename": file.filename, "reason": "S3 upload failed"})
            else:
                # Fallback to local storage
                group_dir = PASSPORT_UPLOADS / group_id
                group_dir.mkdir(parents=True, exist_ok=True)
                file_path = group_dir / f"{passport_no}.jpg"
                async with aiofiles.open(file_path, 'wb') as out_file:
                    await out_file.write(content)
                results["success"].append({"filename": file.filename, "passport_no": passport_no})
                update_result = await db.passports.update_one(
                    {"group_id": group_id, "passport_no": passport_no},
                    {"$set": {"passport_image": f"/api/uploads/passports/{group_id}/{passport_no}.jpg"}}
                )
                if update_result.matched_count > 0:
                    results["mapped"].append(passport_no)
                
        except Exception as e:
            results["failed"].append({"filename": file.filename, "reason": str(e)})
    
    return results

@api_router.post("/groups/{group_id}/upload/photos")
async def bulk_upload_photos(group_id: str, files: List[UploadFile] = File(...)):
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    results = {"success": [], "failed": [], "mapped": []}
    
    for file in files:
        if not validate_file_extension(file.filename):
            results["failed"].append({"filename": file.filename, "reason": "Invalid file type. Only JPG/JPEG allowed."})
            continue
        
        passport_no = extract_passport_number(file.filename)
        content = await file.read()
        
        try:
            if s3_enabled and s3_client:
                # Upload to S3
                s3_key = f"photos/{group_id}/{passport_no}.jpg"
                uploaded = await upload_to_s3(content, s3_key, 'image/jpeg')
                if uploaded:
                    results["success"].append({"filename": file.filename, "passport_no": passport_no})
                    # Store S3 key in database
                    update_result = await db.passports.update_one(
                        {"group_id": group_id, "passport_no": passport_no},
                        {"$set": {"profile_image": f"s3://{s3_key}"}}
                    )
                    if update_result.matched_count > 0:
                        results["mapped"].append(passport_no)
                else:
                    results["failed"].append({"filename": file.filename, "reason": "S3 upload failed"})
            else:
                # Fallback to local storage
                group_dir = PHOTO_UPLOADS / group_id
                group_dir.mkdir(parents=True, exist_ok=True)
                file_path = group_dir / f"{passport_no}.jpg"
                async with aiofiles.open(file_path, 'wb') as out_file:
                    await out_file.write(content)
                results["success"].append({"filename": file.filename, "passport_no": passport_no})
                update_result = await db.passports.update_one(
                    {"group_id": group_id, "passport_no": passport_no},
                    {"$set": {"profile_image": f"/api/uploads/photos/{group_id}/{passport_no}.jpg"}}
                )
                if update_result.matched_count > 0:
                    results["mapped"].append(passport_no)
                
        except Exception as e:
            results["failed"].append({"filename": file.filename, "reason": str(e)})
    
    return results

# Upload relationship proof for a specific passport (required for minors)
@api_router.post("/groups/{group_id}/passports/{passport_id}/relationship-proof")
async def upload_relationship_proof(
    group_id: str,
    passport_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload relationship proof document for minors"""
    # Verify group exists
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Verify passport exists
    passport = await db.passports.find_one({"id": passport_id, "group_id": group_id})
    if not passport:
        raise HTTPException(status_code=404, detail="Passport not found")
    
    # Validate file type
    if not validate_file_extension(file.filename):
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPG/JPEG allowed.")
    
    content = await file.read()
    passport_no = passport.get("passport_no", passport_id)
    
    try:
        if s3_enabled and s3_client:
            # Upload to S3
            s3_key = f"relationship_proofs/{group_id}/{passport_no}.jpg"
            uploaded = await upload_to_s3(content, s3_key, 'image/jpeg')
            if uploaded:
                # Update passport with relationship proof URL
                await db.passports.update_one(
                    {"id": passport_id},
                    {"$set": {"relationship_proof": f"s3://{s3_key}"}}
                )
                return {"success": True, "message": "Relationship proof uploaded successfully"}
            else:
                raise HTTPException(status_code=500, detail="S3 upload failed")
        else:
            # Fallback to local storage
            proof_dir = UPLOADS_DIR / "relationship_proofs" / group_id
            proof_dir.mkdir(parents=True, exist_ok=True)
            file_path = proof_dir / f"{passport_no}.jpg"
            async with aiofiles.open(file_path, 'wb') as out_file:
                await out_file.write(content)
            
            await db.passports.update_one(
                {"id": passport_id},
                {"$set": {"relationship_proof": f"/api/uploads/relationship_proofs/{group_id}/{passport_no}.jpg"}}
            )
            return {"success": True, "message": "Relationship proof uploaded successfully"}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

# API to check if passport holder is a minor
@api_router.get("/groups/{group_id}/passports/{passport_id}/minor-status")
async def check_minor_status(group_id: str, passport_id: str, current_user: dict = Depends(get_current_user)):
    """Check if passport holder is a minor and return applicant type"""
    passport = await db.passports.find_one({"id": passport_id, "group_id": group_id}, {"_id": 0})
    if not passport:
        raise HTTPException(status_code=404, detail="Passport not found")
    
    birth_date = passport.get("birth_date")
    gender = passport.get("gender")
    
    age = calculate_age(birth_date)
    is_minor_flag = age < 18
    applicant_type = get_applicant_type(birth_date, gender)
    
    return {
        "is_minor": is_minor_flag,
        "age": age,
        "applicant_type": applicant_type,
        "relationship_proof_required": is_minor_flag,
        "relationship_proof_uploaded": bool(passport.get("relationship_proof"))
    }

# Serve uploaded files (local fallback or redirect to S3 presigned URL)
@api_router.get("/uploads/passports/{group_id}/{filename}")
async def get_passport_image(group_id: str, filename: str):
    file_path = PASSPORT_UPLOADS / group_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(file_path, media_type="image/jpeg")

@api_router.get("/uploads/photos/{group_id}/{filename}")
async def get_photo_image(group_id: str, filename: str):
    file_path = PHOTO_UPLOADS / group_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(file_path, media_type="image/jpeg")

# New endpoint to get presigned URLs for S3 images
@api_router.get("/s3/presigned-url")
async def get_s3_presigned_url(key: str):
    """Generate a presigned URL for an S3 object"""
    if not s3_enabled:
        raise HTTPException(status_code=503, detail="S3 not configured")
    
    url = generate_presigned_url(key, expiration=3600)  # 1 hour expiration
    if url:
        return {"url": url}
    raise HTTPException(status_code=404, detail="Could not generate URL")

@api_router.get("/s3/status")
async def get_s3_status():
    """Check S3 storage status"""
    return {
        "enabled": s3_enabled,
        "bucket": S3_BUCKET_NAME if s3_enabled else None,
        "region": AWS_REGION if s3_enabled else None
    }

# Download Chrome Extension
@api_router.get("/download/chrome-extension")
async def download_chrome_extension():
    """Download the Chrome extension ZIP file"""
    extension_path = ROOT_DIR.parent / "chrome-extension.zip"
    if not extension_path.exists():
        raise HTTPException(status_code=404, detail="Extension file not found")
    return FileResponse(
        path=str(extension_path),
        filename="iraq-evisa-form-filler-extension.zip",
        media_type="application/zip"
    )

# ============ AUTHENTICATION ENDPOINTS ============

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    """Authenticate user and return JWT token"""
    user = await db.users.find_one({"email": credentials.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token(data={"sub": user["id"]})
    user_response = {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"]
    }
    return Token(access_token=access_token, user=user_response)

@api_router.get("/auth/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user"""
    return current_user

@api_router.post("/auth/init-admin")
async def init_admin():
    """Initialize default admin user if no users exist"""
    user_count = await db.users.count_documents({})
    if user_count > 0:
        return {"message": "Users already exist", "created": False}
    
    # Create default admin user
    admin_user = {
        "id": str(uuid.uuid4()),
        "email": "admin@admin.com",
        "password_hash": get_password_hash("admin123"),
        "name": "Administrator",
        "role": "admin",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(admin_user)
    return {"message": "Default admin created", "created": True, "email": "admin@admin.com"}

# ============ USER MANAGEMENT ENDPOINTS (Admin Only) ============

@api_router.get("/users", response_model=List[User])
async def get_users(current_user: dict = Depends(get_admin_user)):
    """Get all users (admin only)"""
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@api_router.post("/users", response_model=User)
async def create_user(user_data: UserCreate, current_user: dict = Depends(get_admin_user)):
    """Create a new user (admin only)"""
    # Check if email already exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate role
    if user_data.role not in ["admin", "staff"]:
        raise HTTPException(status_code=400, detail="Invalid role. Use 'admin' or 'staff'")
    
    user = {
        "id": str(uuid.uuid4()),
        "email": user_data.email,
        "password_hash": get_password_hash(user_data.password),
        "name": user_data.name,
        "role": user_data.role,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    
    # Return user without password_hash
    del user["password_hash"]
    if "_id" in user:
        del user["_id"]
    return user

@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str, current_user: dict = Depends(get_admin_user)):
    """Get a specific user (admin only)"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@api_router.put("/users/{user_id}", response_model=User)
async def update_user(user_id: str, user_data: UserUpdate, current_user: dict = Depends(get_admin_user)):
    """Update a user (admin only)"""
    update_data = {k: v for k, v in user_data.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    # If email is being updated, check for duplicates
    if "email" in update_data:
        existing = await db.users.find_one({"email": update_data["email"], "id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
    
    # If password is being updated, hash it
    if "password" in update_data:
        update_data["password_hash"] = get_password_hash(update_data.pop("password"))
    
    # Validate role if being updated
    if "role" in update_data and update_data["role"] not in ["admin", "staff"]:
        raise HTTPException(status_code=400, detail="Invalid role. Use 'admin' or 'staff'")
    
    result = await db.users.update_one({"id": user_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return user

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_admin_user)):
    """Delete a user (admin only)"""
    # Prevent deleting yourself
    if current_user["id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted successfully"}

# ============ CLIENT MANAGEMENT ENDPOINTS (Admin Only) ============

@api_router.get("/clients", response_model=List[Client])
async def get_clients(current_user: dict = Depends(get_admin_user)):
    """Get all clients (admin only)"""
    clients = await db.clients.find({}, {"_id": 0}).to_list(1000)
    
    # Add group count for each client
    for client in clients:
        group_count = await db.groups.count_documents({"client_id": client["id"]})
        client["group_count"] = group_count
    
    return clients

@api_router.post("/clients", response_model=Client)
async def create_client(client_data: ClientCreate, current_user: dict = Depends(get_admin_user)):
    """Create a new client (admin only)"""
    client = Client(**client_data.model_dump())
    client_dict = client.model_dump()
    await db.clients.insert_one(client_dict)
    return client

@api_router.get("/clients/{client_id}", response_model=Client)
async def get_client(client_id: str, current_user: dict = Depends(get_admin_user)):
    """Get a specific client (admin only)"""
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Add group count
    group_count = await db.groups.count_documents({"client_id": client_id})
    client["group_count"] = group_count
    
    return client

@api_router.put("/clients/{client_id}", response_model=Client)
async def update_client(client_id: str, client_data: ClientUpdate, current_user: dict = Depends(get_admin_user)):
    """Update a client (admin only)"""
    update_data = {k: v for k, v in client_data.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.clients.update_one({"id": client_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    return client

@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str, current_user: dict = Depends(get_admin_user)):
    """Delete a client (admin only)"""
    # Check if client has groups
    group_count = await db.groups.count_documents({"client_id": client_id})
    if group_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete client with {group_count} linked groups. Reassign or delete groups first.")
    
    result = await db.clients.delete_one({"id": client_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    
    return {"message": "Client deleted successfully"}

# ============ OCR PASSPORT SCANNING ENDPOINT ============

class OCRResult(BaseModel):
    success: bool
    extracted_data: Optional[dict] = None
    raw_text: Optional[str] = None
    error: Optional[str] = None

# Country code to nationality mapping
COUNTRY_TO_NATIONALITY = {
    'AFG': 'Afghan', 'ALB': 'Albanian', 'DZA': 'Algerian', 'AND': 'Andorran', 'AGO': 'Angolan',
    'ARG': 'Argentine', 'ARM': 'Armenian', 'AUS': 'Australian', 'AUT': 'Austrian', 'AZE': 'Azerbaijani',
    'BHR': 'Bahraini', 'BGD': 'Bangladeshi', 'BLR': 'Belarusian', 'BEL': 'Belgian', 'BTN': 'Bhutanese',
    'BOL': 'Bolivian', 'BIH': 'Bosnian', 'BRA': 'Brazilian', 'BRN': 'Bruneian', 'BGR': 'Bulgarian',
    'KHM': 'Cambodian', 'CMR': 'Cameroonian', 'CAN': 'Canadian', 'TCD': 'Chadian', 'CHL': 'Chilean',
    'CHN': 'Chinese', 'COL': 'Colombian', 'CRI': 'Costa Rican', 'HRV': 'Croatian', 'CUB': 'Cuban',
    'CYP': 'Cypriot', 'CZE': 'Czech', 'DNK': 'Danish', 'ECU': 'Ecuadorian', 'EGY': 'Egyptian',
    'EST': 'Estonian', 'ETH': 'Ethiopian', 'FIN': 'Finnish', 'FRA': 'French', 'GEO': 'Georgian',
    'DEU': 'German', 'GHA': 'Ghanaian', 'GRC': 'Greek', 'GTM': 'Guatemalan', 'HND': 'Honduran',
    'HKG': 'Hong Konger', 'HUN': 'Hungarian', 'ISL': 'Icelandic', 'IND': 'Indian', 'IDN': 'Indonesian',
    'IRN': 'Iranian', 'IRQ': 'Iraqi', 'IRL': 'Irish', 'ISR': 'Israeli', 'ITA': 'Italian',
    'JPN': 'Japanese', 'JOR': 'Jordanian', 'KAZ': 'Kazakhstani', 'KEN': 'Kenyan', 'KWT': 'Kuwaiti',
    'KGZ': 'Kyrgyzstani', 'LVA': 'Latvian', 'LBN': 'Lebanese', 'LBY': 'Libyan', 'LTU': 'Lithuanian',
    'LUX': 'Luxembourger', 'MYS': 'Malaysian', 'MDV': 'Maldivian', 'MLT': 'Maltese', 'MEX': 'Mexican',
    'MDA': 'Moldovan', 'MCO': 'Monacan', 'MNG': 'Mongolian', 'MAR': 'Moroccan', 'MMR': 'Myanmar',
    'NPL': 'Nepalese', 'NLD': 'Dutch', 'NZL': 'New Zealander', 'NGA': 'Nigerian', 'PRK': 'North Korean',
    'NOR': 'Norwegian', 'OMN': 'Omani', 'PAK': 'Pakistani', 'PSE': 'Palestinian', 'PAN': 'Panamanian',
    'PER': 'Peruvian', 'PHL': 'Filipino', 'POL': 'Polish', 'PRT': 'Portuguese', 'QAT': 'Qatari',
    'ROU': 'Romanian', 'RUS': 'Russian', 'SAU': 'Saudi', 'SRB': 'Serbian', 'SGP': 'Singaporean',
    'SVK': 'Slovak', 'SVN': 'Slovenian', 'SOM': 'Somali', 'ZAF': 'South African', 'KOR': 'South Korean',
    'ESP': 'Spanish', 'LKA': 'Sri Lankan', 'SDN': 'Sudanese', 'SWE': 'Swedish', 'CHE': 'Swiss',
    'SYR': 'Syrian', 'TWN': 'Taiwanese', 'TJK': 'Tajikistani', 'TZA': 'Tanzanian', 'THA': 'Thai',
    'TUN': 'Tunisian', 'TUR': 'Turkish', 'TKM': 'Turkmen', 'ARE': 'Emirati', 'UGA': 'Ugandan',
    'UKR': 'Ukrainian', 'GBR': 'British', 'USA': 'American', 'URY': 'Uruguayan', 'UZB': 'Uzbekistani',
    'VEN': 'Venezuelan', 'VNM': 'Vietnamese', 'YEM': 'Yemeni', 'ZMB': 'Zambian', 'ZWE': 'Zimbabwean'
}

def parse_mrz(text: str) -> dict:
    """Parse Machine Readable Zone (MRZ) from passport"""
    data = {}
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    # Find MRZ lines (usually start with P< for passport)
    mrz_lines = []
    for line in lines:
        # MRZ lines contain < characters and are typically 44 chars for passport
        if '<' in line and len(line) >= 30:
            # Clean the line - remove spaces
            clean_line = line.replace(' ', '')
            mrz_lines.append(clean_line)
    
    if len(mrz_lines) >= 2:
        line1 = mrz_lines[0]
        line2 = mrz_lines[1] if len(mrz_lines) > 1 else ""
        
        # Parse Line 1: Type, Country, Name
        if line1.startswith('P'):
            # Extract names from line 1
            # MRZ format: P<COUNTRY<<SURNAME<<GIVEN<NAMES
            # Given names section contains first name and middle names, NOT father's name
            name_part = line1[5:] if len(line1) > 5 else ""
            if '<<' in name_part:
                parts = name_part.split('<<')
                surname = parts[0].replace('<', ' ').strip()
                given_names = parts[1].replace('<', ' ').strip() if len(parts) > 1 else ""
                data['surname_en'] = surname.title()
                # Store all given names as first_name_en (user can split manually if needed)
                # Do NOT auto-fill father_name - it's not in MRZ and requires manual entry
                data['first_name_en'] = given_names.title() if given_names else ""
        
        # Parse Line 2: Passport No, Nationality, DOB, Gender, Expiry
        if len(line2) >= 28:
            # Passport number (positions 0-9)
            passport_no = line2[0:9].replace('<', '')
            data['passport_no'] = passport_no
            
            # Nationality (positions 10-12)
            nationality_code = line2[10:13].replace('<', '')
            data['nationality_code'] = nationality_code
            
            # Date of birth (positions 13-19) - YYMMDD
            dob = line2[13:19]
            if dob and len(dob) == 6 and dob.isdigit():
                year = int(dob[0:2])
                # Assume 19xx for years > 30, 20xx for years <= 30
                year = 1900 + year if year > 30 else 2000 + year
                month = dob[2:4]
                day = dob[4:6]
                data['birth_date'] = f"{year}-{month}-{day}"
            
            # Gender (position 20)
            gender = line2[20:21]
            if gender == 'M':
                data['gender'] = 'Male'
            elif gender == 'F':
                data['gender'] = 'Female'
            
            # Expiry date (positions 21-27) - YYMMDD
            exp = line2[21:27]
            if exp and len(exp) == 6 and exp.isdigit():
                year = int(exp[0:2])
                year = 2000 + year  # Expiry is always in 2000s
                month = exp[2:4]
                day = exp[4:6]
                data['expiry_date'] = f"{year}-{month}-{day}"
    
    return data

def parse_passport_text(text: str) -> dict:
    """Parse passport data from OCR text using various patterns"""
    data = {}
    text_upper = text.upper()
    
    # Try MRZ parsing first
    mrz_data = parse_mrz(text)
    if mrz_data:
        data.update(mrz_data)
    
    # Pattern matching for common passport fields
    patterns = {
        'passport_no': [
            r'PASSPORT\s*(?:NO|NUMBER|#)[:\s]*([A-Z0-9]{6,12})',
            r'(?:NO|NUMBER)[:\s]*([A-Z][0-9]{7,8})',
            r'\b([A-Z]{1,2}[0-9]{6,8})\b'
        ],
        'surname_en': [
            r'SURNAME[:\s]*([A-Z]+)',
            r'FAMILY\s*NAME[:\s]*([A-Z]+)'
        ],
        'first_name_en': [
            r'GIVEN\s*NAME[S]?[:\s]*([A-Z]+)',
            r'FIRST\s*NAME[:\s]*([A-Z]+)',
            r'NAME[:\s]*([A-Z]+)'
        ],
        'nationality': [
            r'NATIONALITY[:\s]*([A-Z]+)',
            r'CITIZEN(?:SHIP)?[:\s]*([A-Z]+)'
        ],
        'birth_date': [
            r'(?:DATE\s*OF\s*BIRTH|DOB|BIRTH)[:\s]*(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})',
            r'(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{4})'
        ],
        'expiry_date': [
            r'(?:DATE\s*OF\s*EXPIRY|EXPIRY|EXPIRES?|VALID\s*UNTIL)[:\s]*(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})',
        ],
        'place_of_issue': [
            r'PLACE\s*OF\s*ISSUE[:\s]*([A-Z]+)',
        ],
        'gender': [
            r'SEX[:\s]*(M|F|MALE|FEMALE)',
            r'GENDER[:\s]*(M|F|MALE|FEMALE)'
        ]
    }
    
    for field, field_patterns in patterns.items():
        if field not in data or not data[field]:
            for pattern in field_patterns:
                match = re.search(pattern, text_upper)
                if match:
                    value = match.group(1).strip()
                    if field == 'gender':
                        value = 'Male' if value in ['M', 'MALE'] else 'Female'
                    elif field in ['surname_en', 'first_name_en', 'nationality', 'place_of_issue']:
                        value = value.title()
                    data[field] = value
                    break
    
    return data

@api_router.post("/ocr/scan-passport", response_model=OCRResult)
async def scan_passport(
    image: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Scan passport image and extract data using OCR.space API"""
    
    if not OCR_SPACE_API_KEY:
        raise HTTPException(status_code=500, detail="OCR API key not configured")
    
    # Read the uploaded image
    image_data = await image.read()
    
    # Convert to base64
    base64_image = base64.b64encode(image_data).decode('utf-8')
    
    # Determine file type
    content_type = image.content_type or 'image/jpeg'
    if 'png' in content_type:
        file_type = 'PNG'
    elif 'gif' in content_type:
        file_type = 'GIF'
    else:
        file_type = 'JPG'
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                'https://api.ocr.space/parse/image',
                data={
                    'apikey': OCR_SPACE_API_KEY,
                    'base64Image': f'data:{content_type};base64,{base64_image}',
                    'language': 'eng',
                    'isOverlayRequired': False,
                    'detectOrientation': True,
                    'scale': True,
                    'OCREngine': 2  # Engine 2 is better for passports
                }
            )
            
            result = response.json()
            
            if result.get('IsErroredOnProcessing'):
                error_msg = result.get('ErrorMessage', ['Unknown error'])
                return OCRResult(
                    success=False,
                    error=error_msg[0] if isinstance(error_msg, list) else str(error_msg)
                )
            
            # Extract text from result
            parsed_results = result.get('ParsedResults', [])
            if not parsed_results:
                return OCRResult(
                    success=False,
                    error="No text detected in image"
                )
            
            raw_text = parsed_results[0].get('ParsedText', '')
            
            if not raw_text.strip():
                return OCRResult(
                    success=False,
                    error="No text could be extracted from image"
                )
            
            # Parse the extracted text
            extracted_data = parse_passport_text(raw_text)
            
            return OCRResult(
                success=True,
                extracted_data=extracted_data,
                raw_text=raw_text
            )
            
    except httpx.TimeoutException:
        return OCRResult(
            success=False,
            error="OCR request timed out. Please try again."
        )
    except Exception as e:
        logging.error(f"OCR error: {str(e)}")
        return OCRResult(
            success=False,
            error=f"OCR processing failed: {str(e)}"
        )

@api_router.get("/")
async def root():
    return {"message": "Passport Control Admin API"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
