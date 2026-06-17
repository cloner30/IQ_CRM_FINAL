from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Form, Depends, Query, Body, Header
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
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
import re
from pymongo import UpdateOne

# Jinja2 for PDF template
from jinja2 import Environment, FileSystemLoader
from permissions import (
    check_permission,
    require_permission,
    require_passport_status_update,
    require_submission_details,
    can_access_client,
    can_access_group,
    get_user_client_filter,
    get_user_group_filter,
    normalize_role,
    is_system_role,
    VALID_ROLES,
)
from group_id import generate_group_id, preview_group_id
from migrations import run_migrations
from enterprise_routes import register_enterprise_routes
from accounting_routes import register_accounting_routes
from ocr_service import extract_all_text_from_image, warmup_reader
from passport_parsing import parse_passport_text, map_extracted_fields
from arabic_name_generator import ArabicNameGenerator
from status_sync import (
    build_passport_status_update,
    build_passport_visa_update,
    sync_after_passenger_change,
)

# Setup Jinja2 template environment
TEMPLATE_DIR = Path(__file__).parent / 'templates'
jinja_env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))

# Nationality to Arabic mapping
NATIONALITY_TO_ARABIC = {
    "Afghan": "أفغانية", "Albanian": "ألبانية", "Algerian": "جزائرية", "American": "أمريكية",
    "Argentine": "أرجنتينية", "Armenian": "أرمينية", "Australian": "أسترالية", "Austrian": "نمساوية",
    "Azerbaijani": "أذربيجانية", "Bahraini": "بحرينية", "Bangladeshi": "بنغلاديشية",
    "Barbadians": "باربادوسية", "Belarusians": "بيلاروسية", "Belgian": "بلجيكية",
    "Belizeans": "بليزية", "Beninese": "بنينية", "Bermudian": "برمودية", "Bhutanese": "بوتانية",
    "Bolivian": "بوليفية", "Bosnian": "بوسنية", "Batswana": "بوتسوانية", "Brazilian": "برازيلية",
    "British": "بريطانية", "Bruneian": "بروناوية", "Bulgarian": "بلغارية", "Burkinabe": "بوركينية",
    "Burundian": "بوروندية", "Cambodian": "كمبودية", "Cameroonian": "كاميرونية", "Canadian": "كندية",
    "Cape Verde": "الرأس الأخضر", "Chadian": "تشادية", "Chilean": "تشيلية", "Chinese": "صينية",
    "Colombian": "كولومبية", "Comorian": "قمرية", "Congolese": "كونغولية", "Costa Rican": "كوستاريكية",
    "Croatian": "كرواتية", "Cuban": "كوبية", "Cypriot": "قبرصية", "Czech": "تشيكية",
    "Danish": "دنماركية", "Djiboutians": "جيبوتية", "Dominican": "دومينيكانية", "Dutch": "هولندية",
    "Ecuadorian": "إكوادورية", "Egyptian": "مصرية", "Emirati": "إماراتية", "Eritrean": "إريترية",
    "Estonian": "إستونية", "Ethiopian": "إثيوبية", "Fijian": "فيجية", "Filipino": "فلبينية",
    "Finnish": "فنلندية", "French": "فرنسية", "Gabonese": "غابونية", "Gambian": "غامبية",
    "Georgian": "جورجية", "German": "ألمانية", "Ghanaian": "غانية", "Greek": "يونانية",
    "Greenland": "غرينلاندية", "Grenadian": "غرينادية", "Guatemalan": "غواتيمالية", "Guinean": "غينية",
    "Guyanese": "غيانية", "Haitian": "هايتية", "Honduran": "هندوراسية", "Hungarian": "هنغارية",
    "Icelandic": "آيسلندية", "Indian": "هندية", "Indonesian": "إندونيسية", "Iranian": "إيرانية",
    "Iraqi": "عراقية", "Irish": "إيرلندية", "Italian": "إيطالية", "Jamaican": "جامايكية",
    "Japanese": "يابانية", "Jordanian": "أردنية", "Kazakh": "كازاخستانية", "Kenyan": "كينية",
    "Kiribati": "كيريباتية", "Korean": "كورية", "Kosovoi": "كوسوفية", "Kuwaiti": "كويتية",
    "Kyrgyz": "قيرغيزية", "Lao": "لاوية", "Latvian": "لاتفية", "Lebanese": "لبنانية",
    "Lesotho": "ليسوتية", "Liberian": "ليبيرية", "Libyan": "ليبية", "Liechtensteiners": "ليختنشتاينية",
    "Lithuanian": "ليتوانية", "Luxembourgish": "لوكسمبورغية", "Macedonians": "مقدونية",
    "Malagasy": "مدغشقرية", "Malawian": "مالاوية", "Malaysian": "ماليزية", "Maldivian": "مالديفية",
    "Malian": "مالية", "Maltese": "مالطية", "Mauritanian": "موريتانية", "Mauritian": "موريشيوسية",
    "Mexican": "مكسيكية", "Micronesia": "ميكرونيزية", "Moldavians": "مولدوفية", "Monegasque": "موناكية",
    "Mongolian": "منغولية", "Montenegrin": "مونتينيغرية", "Moroccan": "مغربية", "Mozambican": "موزمبيقية",
    "Myanmar": "ميانمارية", "Namibian": "ناميبية", "Naurun": "ناورونية", "Nepalese": "نيبالية",
    "New Zealand": "نيوزيلندية", "Nicaraguan": "نيكاراغوية", "Niger": "نيجرية", "Nigerian": "نيجيرية",
    "Norwegian": "نرويجية", "Omani": "عمانية", "Pakistani": "باكستانية", "Palau": "بالاوية",
    "Palestinian": "فلسطينية", "Panamanian": "بنمية", "Papua New Guinea": "بابوانية",
    "Paraguayan": "باراغوايية", "Peruvian": "بيروفية", "Philippine": "فلبينية", "Polish": "بولندية",
    "Portuguese": "برتغالية", "Puerto Rico": "بورتوريكية", "Qatari": "قطرية", "Romanian": "رومانية",
    "Russian": "روسية", "Rwandan": "رواندية", "Saint Lucia": "سانت لوسية", "Samoa": "ساموائية",
    "San Marino": "سان مارينية", "Sao Tome": "ساوتومية", "Saudi": "سعودية", "Senegalese": "سنغالية",
    "Serbian": "صربية", "Seychelles": "سيشيلية", "Sierra Leonean": "سيراليونية",
    "Singaporean": "سنغافورية", "Slovak": "سلوفاكية", "Slovenia": "سلوفينية",
    "Solomon Islands": "جزر سليمان", "Somalian": "صومالية", "South African": "جنوب أفريقية",
    "Spanish": "إسبانية", "Sri Lankan": "سريلانكية", "Sudanese": "سودانية", "Suriname": "سورينامية",
    "Swazi": "سوازيلندية", "Swedish": "سويدية", "Swiss": "سويسرية", "Syrian": "سورية",
    "Tajikistani": "طاجيكستانية", "Tanzanian": "تنزانية", "Thai": "تايلاندية",
    "Timor Leste": "تيمورية", "Togolese": "توغولية", "Tokelau": "توكيلاوية", "Tongan": "تونغية",
    "Trinidad and Tobago": "ترينيدادية", "Tunisian": "تونسية", "Turkish": "تركية",
    "Turkmen": "تركمانستانية", "Tuvalu": "توفالية", "Ugandan": "أوغندية", "Ukrainian": "أوكرانية",
    "Uruguayan": "أوروغوايية", "Uzbekistani": "أوزبكستانية", "Vanuatu": "فانواتية",
    "Venezuelan": "فنزويلية", "Vietnamese": "فيتنامية", "Yemeni": "يمنية", "Zambian": "زامبية",
    "Zimbabwean": "زيمبابوية"
}

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
_env = os.environ.get('ENV', 'development').lower()
_jwt_secret = os.environ.get('JWT_SECRET_KEY')
if _env == 'production' and not _jwt_secret:
    raise RuntimeError('JWT_SECRET_KEY must be set in production')
SECRET_KEY = _jwt_secret or 'passport-control-secret-key-change-in-production'
if _env != 'production' and not _jwt_secret:
    logging.warning('JWT_SECRET_KEY not set — using insecure default (development only)')
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
    if user.get("status") == "inactive":
        raise HTTPException(status_code=403, detail="Account is inactive")
    return user

async def get_admin_user(current_user: dict = Depends(get_current_user)):
    """System admin access (backward compatible with super_admin/admin)."""
    if not check_permission(current_user, "can_manage_clients"):
        raise HTTPException(status_code=403, detail="System Admin access required")
    return current_user

async def get_client_admin_or_above(current_user: dict = Depends(get_current_user)):
    """Client admin, vendor admin, or system admin access."""
    role = normalize_role(current_user.get("role"))
    if role in ("system_admin", "system_staff", "client_admin", "vendor_admin"):
        return current_user
    if check_permission(current_user, "can_manage_users"):
        return current_user
    raise HTTPException(status_code=403, detail="Admin access required")

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
    client_id: Optional[str] = None
    departure_date: Optional[str] = None
    passenger_count: Optional[int] = None

class GroupSubmissionDetails(BaseModel):
    approval_number: Optional[str] = None
    date_of_payment: Optional[str] = None

class Group(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    passport_count: int = 0
    passenger_count: Optional[int] = None
    departure_date: Optional[str] = None
    status: str = "DATA_PROCESSING"
    assigned_vendor_id: Optional[str] = None
    assigned_at: Optional[str] = None
    split_from_group_id: Optional[str] = None
    is_archived: bool = False
    approval_number: Optional[str] = None
    date_of_payment: Optional[str] = None
    base_price_per_passport: Optional[float] = None
    rush_fee: Optional[float] = None
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
    parent_passport_id: Optional[str] = None  # Link minor to parent's passport in same group
    relationship_proof: Optional[str] = None  # S3 URL for relationship proof (for minors)

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
    parent_passport_id: Optional[str] = None  # Link minor to parent's passport in same group
    relationship_proof: Optional[str] = None  # S3 URL for relationship proof (for minors)
    passport_image: Optional[str] = None
    profile_image: Optional[str] = None
    insurance_pdf: Optional[str] = None  # S3 URL for insurance PDF
    visa_pdf: Optional[str] = None  # S3 URL for visa copy
    status: str = "pending"  # pending, done (form filling status)
    visa_status: str = "pending"  # pending, form_submitted, payment_done, visa_issued, visa_rejected
    visa_status_updated_at: Optional[str] = None
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
    parent_passport_id: Optional[str] = None  # Link minor to parent
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
    role: str = "client_staff"
    client_id: Optional[str] = None
    vendor_id: Optional[str] = None
    status: str = "active"

class UserUpdate(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None
    client_id: Optional[str] = None
    vendor_id: Optional[str] = None
    status: Optional[str] = None

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    role: str = "client_staff"
    client_id: Optional[str] = None
    vendor_id: Optional[str] = None
    permissions: Optional[dict] = None
    status: str = "active"
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
    base_price_per_passport: float = 20.0
    rush_fee: float = 0.0

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    company_name: Optional[str] = None
    contact_person_name: Optional[str] = None
    contact_person_no: Optional[str] = None
    email: Optional[str] = None
    mobile_no: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    base_price_per_passport: Optional[float] = None
    rush_fee: Optional[float] = None

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
    base_price_per_passport: float = 20.0
    rush_fee: float = 0.0
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
    require_permission(current_user, "can_view_operational")
    query = get_user_group_filter(current_user)
    
    # If specific client_id requested, verify access and use it
    if client_id:
        if not can_access_client(current_user, client_id):
            raise HTTPException(status_code=403, detail="Access denied to this client's data")
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
    require_permission(current_user, "can_view_operational")
    if not check_permission(current_user, "can_create_group_any_client"):
        if current_user.get("client_id"):
            group_data_dict = group_data.model_dump()
            group_data_dict["client_id"] = current_user.get("client_id")
            group_data = GroupCreate(**group_data_dict)
        else:
            raise HTTPException(status_code=403, detail="User not associated with any client")
    elif group_data.client_id and not can_access_client(current_user, group_data.client_id):
        raise HTTPException(status_code=403, detail="Cannot create group for other client")

    client_doc = None
    if group_data.client_id:
        client_doc = await db.clients.find_one({"id": group_data.client_id}, {"_id": 0})
        if not client_doc:
            raise HTTPException(status_code=400, detail="Client not found")

    group_dict = group_data.model_dump()
    if client_doc:
        group_dict["base_price_per_passport"] = client_doc.get("base_price_per_passport", 20.0)
        group_dict["rush_fee"] = client_doc.get("rush_fee", 0.0)
    if group_data.departure_date:
        group_dict["id"] = await generate_group_id(db, group_data.departure_date)
    group_dict["status"] = "DATA_PROCESSING"
    group_dict["is_archived"] = False
    group = Group(**group_dict)
    doc = group.model_dump()
    await db.groups.insert_one(doc)
    return group

@api_router.get("/groups/preview-id")
async def preview_group_id_route(departure_date: str = Query(...), current_user: dict = Depends(get_current_user)):
    require_permission(current_user, "can_view_operational")
    group_id = await preview_group_id(db, departure_date)
    return {"group_id": group_id}

@api_router.get("/groups/{group_id}", response_model=Group)
async def get_group(group_id: str, current_user: dict = Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check access
    if not can_access_group(current_user, group):
        raise HTTPException(status_code=403, detail="Access denied to this group")
    
    # Add client name
    if group.get("client_id"):
        client = await db.clients.find_one({"id": group["client_id"]}, {"_id": 0, "name": 1})
        group["client_name"] = client["name"] if client else "Unknown"
    else:
        group["client_name"] = None
    
    return group

@api_router.put("/groups/{group_id}", response_model=Group)
async def update_group(group_id: str, group_data: GroupCreate, current_user: dict = Depends(get_current_user)):
    # First check if group exists and user has access
    existing_group = await db.groups.find_one({"id": group_id}, {"_id": 0})
    if not existing_group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if not can_access_group(current_user, existing_group):
        raise HTTPException(status_code=403, detail="Access denied to this group")
    
    # For client users, don't allow changing client_id
    if not check_permission(current_user, "can_create_group_any_client"):
        group_data_dict = group_data.model_dump()
        group_data_dict["client_id"] = existing_group.get("client_id")
        group_data = GroupCreate(**group_data_dict)
    
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
    """Update approval number and date of payment for a group.
    When date_of_payment is set, all passports with visa_status='form_submitted' are updated to 'payment_done'."""
    require_submission_details(current_user)
    # Check if group exists
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check access
    if not can_access_group(current_user, group):
        raise HTTPException(status_code=403, detail="Access denied to this group")
    
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
    
    # When date_of_payment is set, update all form_submitted passports to payment_done
    if submission_data.date_of_payment:
        now = datetime.now(timezone.utc).isoformat()
        await db.passports.update_many(
            {"group_id": group_id, "visa_status": "form_submitted"},
            {"$set": {
                "visa_status": "payment_done",
                "visa_status_updated_at": now
            }}
        )
        await sync_after_passenger_change(db, group_id, current_user["id"])
    
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
    # Check if group exists and user has access
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if not can_access_group(current_user, group):
        raise HTTPException(status_code=403, detail="Access denied to this group")
    
    await db.passports.delete_many({"group_id": group_id})
    result = await db.groups.delete_one({"id": group_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Group not found")
    return {"message": "Group deleted successfully"}

# Helper function to verify group access
async def verify_group_access(group_id: str, current_user: dict) -> dict:
    """Verify that user has access to the group and return the group"""
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if not can_access_group(current_user, group):
        raise HTTPException(status_code=403, detail="Access denied to this group")
    
    return group


def require_edit_passports(user: dict) -> None:
    require_permission(user, "can_edit_passports")


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
    # Verify group access
    await verify_group_access(group_id, current_user)
    
    passports = await db.passports.find({"group_id": group_id}, {"_id": 0}).to_list(1000)
    # Process S3 images to presigned URLs
    processed_passports = [process_passport_images(p) for p in passports]
    return processed_passports

@api_router.post("/groups/{group_id}/passports", response_model=Passport)
async def create_passport(group_id: str, passport_data: PassportCreate, current_user: dict = Depends(get_current_user)):
    require_edit_passports(current_user)
    group = await verify_group_access(group_id, current_user)
    
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
    await verify_group_access(group_id, current_user)
    passport = await db.passports.find_one({"id": passport_id, "group_id": group_id}, {"_id": 0})
    if not passport:
        raise HTTPException(status_code=404, detail="Passport not found")
    # Process S3 images to presigned URLs
    return process_passport_images(passport)

@api_router.put("/groups/{group_id}/passports/{passport_id}", response_model=Passport)
async def update_passport(group_id: str, passport_id: str, passport_data: PassportUpdate, current_user: dict = Depends(get_current_user)):
    require_edit_passports(current_user)
    await verify_group_access(group_id, current_user)
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
    require_edit_passports(current_user)
    await verify_group_access(group_id, current_user)
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
    """Update passport processing status (pending/done). When done, visa_status becomes form_submitted."""
    require_passport_status_update(current_user)
    passport = await db.passports.find_one({"id": passport_id})
    if not passport:
        raise HTTPException(status_code=404, detail="Passport not found")
    await verify_group_access(passport["group_id"], current_user)
    if status not in ["pending", "done"]:
        raise HTTPException(status_code=400, detail="Invalid status. Use 'pending' or 'done'")
    
    now = datetime.now(timezone.utc).isoformat()
    current_visa = passport.get("visa_status", "pending")
    update_data = build_passport_status_update(status, current_visa, now)
    
    result = await db.passports.update_one(
        {"id": passport_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Passport not found")
    
    await sync_after_passenger_change(db, passport["group_id"], current_user["id"])
    
    passport = await db.passports.find_one({"id": passport_id}, {"_id": 0})
    return process_passport_images(passport)

# Bulk status update endpoint
@api_router.put("/groups/{group_id}/passports/bulk-status")
async def bulk_update_passport_status(group_id: str, passport_ids: List[str], status: str, current_user: dict = Depends(get_current_user)):
    """Bulk update passport processing status. When done, visa_status becomes form_submitted."""
    require_passport_status_update(current_user)
    await verify_group_access(group_id, current_user)
    if status not in ["pending", "done"]:
        raise HTTPException(status_code=400, detail="Invalid status. Use 'pending' or 'done'")
    
    now = datetime.now(timezone.utc).isoformat()
    
    if status == "done":
        passports = await db.passports.find(
            {"id": {"$in": passport_ids}, "group_id": group_id},
            {"_id": 0, "id": 1, "visa_status": 1},
        ).to_list(10000)
        bulk_ops = []
        for p in passports:
            update_data = build_passport_status_update(status, p.get("visa_status", "pending"), now)
            bulk_ops.append(UpdateOne({"id": p["id"]}, {"$set": update_data}))
        if bulk_ops:
            await db.passports.bulk_write(bulk_ops)
        modified = len(bulk_ops)
    else:
        update_data = build_passport_status_update(status, "pending", now)
        result = await db.passports.update_many(
            {"id": {"$in": passport_ids}, "group_id": group_id},
            {"$set": update_data}
        )
        modified = result.modified_count
    
    await sync_after_passenger_change(db, group_id, current_user["id"])
    
    return {"updated": modified}

# Visa status constants
VALID_VISA_STATUSES = ["pending", "form_submitted", "payment_done", "visa_issued", "visa_rejected"]

# Visa status update endpoint
@api_router.put("/passports/{passport_id}/visa-status")
async def update_passport_visa_status(passport_id: str, visa_status: str, current_user: dict = Depends(get_current_user)):
    """Update passport visa status"""
    require_passport_status_update(current_user)
    passport = await db.passports.find_one({"id": passport_id})
    if not passport:
        raise HTTPException(status_code=404, detail="Passport not found")
    await verify_group_access(passport["group_id"], current_user)
    if visa_status not in VALID_VISA_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid visa status. Use one of: {VALID_VISA_STATUSES}")

    now = datetime.now(timezone.utc).isoformat()
    update_data = build_passport_visa_update(visa_status, now)
    
    result = await db.passports.update_one(
        {"id": passport_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Passport not found")
    
    await sync_after_passenger_change(db, passport["group_id"], current_user["id"])
    
    passport = await db.passports.find_one({"id": passport_id}, {"_id": 0})
    return process_passport_images(passport)

# Bulk visa status update endpoint
@api_router.put("/groups/{group_id}/passports/bulk-visa-status")
async def bulk_update_passport_visa_status(group_id: str, passport_ids: List[str] = Body(...), visa_status: str = Query(...), current_user: dict = Depends(get_current_user)):
    """Bulk update passport visa status"""
    require_passport_status_update(current_user)
    await verify_group_access(group_id, current_user)
    if visa_status not in VALID_VISA_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid visa status. Use one of: {VALID_VISA_STATUSES}")
    
    now = datetime.now(timezone.utc).isoformat()
    update_data = build_passport_visa_update(visa_status, now)
    
    result = await db.passports.update_many(
        {"id": {"$in": passport_ids}, "group_id": group_id},
        {"$set": update_data}
    )
    
    await sync_after_passenger_change(db, group_id, current_user["id"])
    
    return {"updated": result.modified_count}

# Mark all as visa issued endpoint
@api_router.post("/groups/{group_id}/passports/mark-all-visa-issued")
async def mark_all_passports_visa_issued(group_id: str, current_user: dict = Depends(get_current_user)):
    """Mark all passports in a group as visa_issued (only those with payment_done status)"""
    require_passport_status_update(current_user)
    await verify_group_access(group_id, current_user)
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Only update passports that are in payment_done status
    result = await db.passports.update_many(
        {"group_id": group_id, "visa_status": "payment_done"},
        {"$set": {
            "visa_status": "visa_issued",
            "visa_status_updated_at": now,
            "status": "done",
            "status_updated_at": now,
        }}
    )
    
    await sync_after_passenger_change(db, group_id, current_user["id"])
    
    return {"updated": result.modified_count}


# Get group stats endpoint
@api_router.get("/groups/{group_id}/stats")
async def get_group_stats(group_id: str, current_user: dict = Depends(get_current_user)):
    """Get passport processing and visa stats for a group"""
    # Verify group access
    await verify_group_access(group_id, current_user)
    
    total = await db.passports.count_documents({"group_id": group_id})
    done = await db.passports.count_documents({"group_id": group_id, "status": "done"})
    pending = total - done
    
    # Visa status counts
    visa_pending = await db.passports.count_documents({"group_id": group_id, "visa_status": "pending"})
    visa_form_submitted = await db.passports.count_documents({"group_id": group_id, "visa_status": "form_submitted"})
    visa_payment_done = await db.passports.count_documents({"group_id": group_id, "visa_status": "payment_done"})
    visa_issued = await db.passports.count_documents({"group_id": group_id, "visa_status": "visa_issued"})
    visa_rejected = await db.passports.count_documents({"group_id": group_id, "visa_status": "visa_rejected"})
    
    return {
        "total": total,
        "done": done,
        "pending": pending,
        "progress_percent": round((done / total * 100) if total > 0 else 0, 1),
        "visa_stats": {
            "pending": visa_pending,
            "form_submitted": visa_form_submitted,
            "payment_done": visa_payment_done,
            "visa_issued": visa_issued,
            "visa_rejected": visa_rejected,
        }
    }

# CSV Export endpoint
@api_router.get("/groups/{group_id}/export/csv")
async def export_passports_csv(group_id: str, current_user: dict = Depends(get_current_user)):
    require_permission(current_user, "can_export")
    await verify_group_access(group_id, current_user)
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

# Helper function for Arabic text rendering in PDF
def render_arabic(text):
    """Reshape and reorder Arabic text for proper PDF rendering"""
    if not text:
        return ""
    try:
        return str(text)
    except:
        return str(text)

def get_birth_year(birth_date):
    """Extract only the year from birth date"""
    if not birth_date:
        return ""
    try:
        if '-' in str(birth_date):
            return str(birth_date).split('-')[0]
        elif '/' in str(birth_date):
            parts = str(birth_date).split('/')
            # Handle both m/d/yyyy and yyyy/m/d formats
            for part in parts:
                if len(part) == 4:
                    return part
        return str(birth_date)[:4] if len(str(birth_date)) >= 4 else str(birth_date)
    except:
        return str(birth_date)

def get_nationality_arabic(nationality):
    """Convert nationality to Arabic"""
    if not nationality:
        return ""
    return NATIONALITY_TO_ARABIC.get(nationality, nationality)

# PDF Passenger List Export endpoint using WeasyPrint + Jinja2
@api_router.get("/groups/{group_id}/export/passenger-list-pdf")
async def export_passenger_list_pdf(group_id: str, ref_number: str = "", current_user: dict = Depends(get_current_user)):
    """Export passenger list as PDF in A4 Landscape format with Arabic header/footer"""
    require_permission(current_user, "can_export")
    await verify_group_access(group_id, current_user)
    group = await db.groups.find_one({"id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    passports = await db.passports.find({"group_id": group_id}, {"_id": 0}).to_list(1000)
    
    if not passports:
        raise HTTPException(status_code=404, detail="No passports found in this group")
    
    # Prepare passenger data for template
    passengers = []
    for passport in passports:
        passengers.append({
            'given_name': (passport.get('first_name_en', '') or '').upper(),
            'father_name': (passport.get('father_name_en', '') or '').upper(),
            'surname': (passport.get('surname_en', '') or '').upper(),
            'passport_no': (passport.get('passport_no', '') or '').upper(),
            'nationality_ar': get_nationality_arabic(passport.get('nationality', '')),
            'birth_year': get_birth_year(passport.get('birth_date', ''))
        })
    
    # Calculate if we need page stamps (multiple pages = more than ~18 passengers)
    # Page stamp should only appear on non-last pages
    # If single page (<=18 passengers), no page stamp needed (footer has stamp)
    # If multiple pages, show page stamp on all pages except last
    show_page_stamp = len(passengers) > 18
    
    # Load and render template
    template = jinja_env.get_template('passenger_list.html')
    html_content = template.render(
        group_name=group['name'],
        ref_number=ref_number or str(len(passengers)),
        passengers=passengers,
        show_page_stamp=show_page_stamp
    )
    
    # Generate PDF from HTML (lazy import WeasyPrint)
    try:
        from weasyprint import HTML
        pdf_buffer = BytesIO()
        HTML(string=html_content).write_pdf(pdf_buffer)
        pdf_buffer.seek(0)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")
    
    filename = f"{group['name'].replace(' ', '_')}_passenger_list.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# Excel/CSV bulk import endpoint
@api_router.post("/groups/{group_id}/import/excel")
async def bulk_import_excel(group_id: str, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    require_permission(current_user, "can_import")
    await verify_group_access(group_id, current_user)
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
async def get_import_template(current_user: dict = Depends(get_current_user)):
    require_permission(current_user, "can_import")
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
async def bulk_upload_passports(group_id: str, files: List[UploadFile] = File(...), current_user: dict = Depends(get_current_user)):
    require_permission(current_user, "can_upload_files")
    await verify_group_access(group_id, current_user)
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
async def bulk_upload_photos(group_id: str, files: List[UploadFile] = File(...), current_user: dict = Depends(get_current_user)):
    require_permission(current_user, "can_upload_files")
    await verify_group_access(group_id, current_user)
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
    require_permission(current_user, "can_upload_files")
    await verify_group_access(group_id, current_user)
    
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

@api_router.post("/groups/{group_id}/passports/{passport_id}/insurance-pdf")
async def upload_insurance_pdf(
    group_id: str,
    passport_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload insurance PDF for a passport"""
    require_permission(current_user, "can_upload_files")
    await verify_group_access(group_id, current_user)
    
    passport = await db.passports.find_one({"id": passport_id, "group_id": group_id})
    if not passport:
        raise HTTPException(status_code=404, detail="Passport not found")
    
    # Validate file type - allow PDF
    filename = file.filename.lower()
    if not filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF files allowed.")
    
    content = await file.read()
    passport_no = passport.get("passport_no", passport_id)
    
    try:
        if s3_enabled and s3_client:
            # Upload to S3
            s3_key = f"insurance_pdfs/{group_id}/{passport_no}.pdf"
            uploaded = await upload_to_s3(content, s3_key, 'application/pdf')
            if uploaded:
                # Generate presigned URL for download
                presigned_url = generate_presigned_url(s3_key)
                # Update passport with insurance PDF URL
                await db.passports.update_one(
                    {"id": passport_id},
                    {"$set": {"insurance_pdf": f"s3://{s3_key}"}}
                )
                return {"success": True, "message": "Insurance PDF uploaded successfully", "url": presigned_url}
            else:
                raise HTTPException(status_code=500, detail="S3 upload failed")
        else:
            # Fallback to local storage
            pdf_dir = UPLOADS_DIR / "insurance_pdfs" / group_id
            pdf_dir.mkdir(parents=True, exist_ok=True)
            file_path = pdf_dir / f"{passport_no}.pdf"
            async with aiofiles.open(file_path, 'wb') as out_file:
                await out_file.write(content)
            
            await db.passports.update_one(
                {"id": passport_id},
                {"$set": {"insurance_pdf": f"/api/uploads/insurance_pdfs/{group_id}/{passport_no}.pdf"}}
            )
            return {"success": True, "message": "Insurance PDF uploaded successfully"}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@api_router.post("/passports/insurance-pdf-by-passport-no")
async def upload_insurance_pdf_by_passport_no(
    passport_no: str = Form(...),
    group_id: str = Form(...),
    full_name_en: str = Form(None),  # Optional: Full name from e-visa page
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload insurance PDF for a passport by passport number (used by Chrome extension).
    If passport doesn't exist in the group, it will be created automatically."""
    require_permission(current_user, "can_upload_files")
    group = await verify_group_access(group_id, current_user)
    
    passport = await db.passports.find_one({"passport_no": passport_no, "group_id": group_id})
    
    # If passport doesn't exist, create it automatically
    if not passport:
        # Parse full name if provided
        first_name_en = ""
        surname_en = ""
        if full_name_en:
            name_parts = full_name_en.strip().split()
            if len(name_parts) >= 2:
                first_name_en = name_parts[0]
                surname_en = " ".join(name_parts[1:])
            elif len(name_parts) == 1:
                first_name_en = name_parts[0]
        
        # Create new passport record
        new_passport = {
            "id": str(uuid.uuid4()),
            "group_id": group_id,
            "passport_no": passport_no,
            "first_name_en": first_name_en,
            "surname_en": surname_en,
            "nationality": "",
            "expiry_date": "",
            "status": "done",  # Mark as done since visa was already processed
            "status_updated_at": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.passports.insert_one(new_passport)
        
        # Update group passport count
        await db.groups.update_one(
            {"id": group_id},
            {"$inc": {"passport_count": 1}}
        )
        
        passport = new_passport
        logging.info(f"Created new passport record for {passport_no} in group {group_id}")
    
    # Validate file type - allow PDF
    filename = file.filename.lower()
    if not filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF files allowed.")
    
    content = await file.read()
    
    try:
        if s3_enabled and s3_client:
            # Upload to S3
            s3_key = f"insurance_pdfs/{group_id}/{passport_no}.pdf"
            uploaded = await upload_to_s3(content, s3_key, 'application/pdf')
            if uploaded:
                # Generate presigned URL for download
                presigned_url = generate_presigned_url(s3_key)
                # Update passport with insurance PDF URL
                await db.passports.update_one(
                    {"id": passport["id"]},
                    {"$set": {"insurance_pdf": f"s3://{s3_key}"}}
                )
                return {
                    "success": True, 
                    "message": f"Insurance PDF uploaded for {passport_no}", 
                    "url": presigned_url,
                    "passport_id": passport["id"],
                    "created_new": passport.get("created_at") == passport.get("status_updated_at")  # Indicates if newly created
                }
            else:
                raise HTTPException(status_code=500, detail="S3 upload failed")
        else:
            # Fallback to local storage
            pdf_dir = UPLOADS_DIR / "insurance_pdfs" / group_id
            pdf_dir.mkdir(parents=True, exist_ok=True)
            file_path = pdf_dir / f"{passport_no}.pdf"
            async with aiofiles.open(file_path, 'wb') as out_file:
                await out_file.write(content)
            
            await db.passports.update_one(
                {"id": passport["id"]},
                {"$set": {"insurance_pdf": f"/api/uploads/insurance_pdfs/{group_id}/{passport_no}.pdf"}}
            )
            return {
                "success": True, 
                "message": f"Insurance PDF uploaded for {passport_no}",
                "passport_id": passport["id"]
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

# API to check if passport holder is a minor
@api_router.get("/groups/{group_id}/passports/{passport_id}/minor-status")
async def check_minor_status(group_id: str, passport_id: str, current_user: dict = Depends(get_current_user)):
    """Check if passport holder is a minor and return applicant type"""
    await verify_group_access(group_id, current_user)
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
async def get_passport_image(group_id: str, filename: str, current_user: dict = Depends(get_current_user)):
    await verify_group_access(group_id, current_user)
    file_path = PASSPORT_UPLOADS / group_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(file_path, media_type="image/jpeg")

@api_router.get("/uploads/photos/{group_id}/{filename}")
async def get_photo_image(group_id: str, filename: str, current_user: dict = Depends(get_current_user)):
    await verify_group_access(group_id, current_user)
    file_path = PHOTO_UPLOADS / group_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(file_path, media_type="image/jpeg")

# New endpoint to get presigned URLs for S3 images
@api_router.get("/s3/presigned-url")
async def get_s3_presigned_url(key: str, current_user: dict = Depends(get_current_user)):
    """Generate a presigned URL for an S3 object"""
    require_permission(current_user, "can_view_operational")
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

def normalize_email(email: str) -> str:
    return email.strip().lower()


def email_case_insensitive_filter(email: str) -> dict:
    """Match stored email regardless of casing."""
    escaped = re.escape(email.strip())
    return {"email": {"$regex": f"^{escaped}$", "$options": "i"}}


@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    """Authenticate user and return JWT token"""
    user = await db.users.find_one(email_case_insensitive_filter(credentials.email))
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token(data={"sub": user["id"]})
    from permissions import get_role_permissions
    user_response = {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "client_id": user.get("client_id"),
        "vendor_id": user.get("vendor_id"),
        "permissions": get_role_permissions(user),
    }
    return Token(access_token=access_token, user=user_response)

@api_router.get("/auth/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user with permissions"""
    from permissions import get_role_permissions
    current_user["permissions"] = get_role_permissions(current_user)
    return current_user

@api_router.post("/auth/init-admin")
async def init_admin(x_init_token: Optional[str] = Header(None, alias="X-Init-Token")):
    """Initialize default admin user if no users exist"""
    user_count = await db.users.count_documents({})
    init_token = os.environ.get("INIT_ADMIN_TOKEN")
    if user_count > 0:
        if not init_token or x_init_token != init_token:
            raise HTTPException(status_code=403, detail="Init admin disabled — set INIT_ADMIN_TOKEN header")
        await db.users.update_many(
            {"role": {"$in": ["admin", "super_admin"]}},
            {"$set": {"role": "system_admin"}},
        )
        return {"message": "Upgraded legacy admins to system_admin", "created": False}

    if init_token and x_init_token != init_token:
        raise HTTPException(status_code=403, detail="Invalid init token")

    admin_user = {
        "id": str(uuid.uuid4()),
        "email": "admin@admin.com",
        "password_hash": get_password_hash("admin123"),
        "name": "System Administrator",
        "role": "system_admin",
        "client_id": None,
        "vendor_id": None,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(admin_user)
    return {"message": "Default super admin created", "created": True, "email": "admin@admin.com"}

# ============ USER MANAGEMENT ENDPOINTS ============

@api_router.get("/users", response_model=List[User])
async def get_users(current_user: dict = Depends(get_current_user)):
    """Get users - system admin sees all, client/vendor admin sees their org users"""
    role = normalize_role(current_user.get("role"))
    if role in ("system_admin", "system_staff"):
        users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    elif role == "client_admin":
        users = await db.users.find(
            {"client_id": current_user.get("client_id")},
            {"_id": 0, "password_hash": 0}
        ).to_list(1000)
    elif role == "vendor_admin":
        users = await db.users.find(
            {"vendor_id": current_user.get("vendor_id")},
            {"_id": 0, "password_hash": 0}
        ).to_list(1000)
    else:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Add client name for each user
    for user in users:
        if user.get("client_id"):
            client = await db.clients.find_one({"id": user["client_id"]}, {"_id": 0, "name": 1})
            user["client_name"] = client["name"] if client else "Unknown"
        else:
            user["client_name"] = None
    
    return users

@api_router.post("/users", response_model=User)
async def create_user(user_data: UserCreate, current_user: dict = Depends(get_client_admin_or_above)):
    """Create a new user"""
    normalized_email = normalize_email(user_data.email)
    existing = await db.users.find_one(email_case_insensitive_filter(normalized_email))
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    if user_data.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Use one of: {VALID_ROLES}")

    creator_role = normalize_role(current_user.get("role"))
    if creator_role in ("system_admin", "system_staff"):
        if user_data.role == "system_admin" and creator_role != "system_admin":
            raise HTTPException(status_code=403, detail="Only system_admin can create system_admin users")
        if user_data.role in ("system_admin", "system_staff", "system_accounts") and creator_role != "system_admin":
            raise HTTPException(status_code=403, detail="Only system_admin can create system roles")
        if user_data.role in ("client_admin", "client_staff", "client_accounts") and not user_data.client_id:
            raise HTTPException(status_code=400, detail="client_id required for client roles")
        if user_data.role in ("vendor_admin", "vendor_staff", "vendor_accounts") and not user_data.vendor_id:
            raise HTTPException(status_code=400, detail="vendor_id required for vendor roles")
        if user_data.client_id:
            client = await db.clients.find_one({"id": user_data.client_id})
            if not client:
                raise HTTPException(status_code=400, detail="Client not found")
        if user_data.vendor_id:
            vendor = await db.vendors.find_one({"id": user_data.vendor_id})
            if not vendor:
                raise HTTPException(status_code=400, detail="Vendor not found")
    elif creator_role == "client_admin":
        if user_data.role not in ("client_admin", "client_staff", "client_accounts"):
            raise HTTPException(status_code=403, detail="You can only create client users")
        user_data_dict = user_data.model_dump()
        user_data_dict["client_id"] = current_user.get("client_id")
        user_data = UserCreate(**user_data_dict)
    elif creator_role == "vendor_admin":
        if user_data.role not in ("vendor_admin", "vendor_staff", "vendor_accounts"):
            raise HTTPException(status_code=403, detail="You can only create vendor users")
        user_data_dict = user_data.model_dump()
        user_data_dict["vendor_id"] = current_user.get("vendor_id")
        user_data = UserCreate(**user_data_dict)

    user = {
        "id": str(uuid.uuid4()),
        "email": normalized_email,
        "password_hash": get_password_hash(user_data.password),
        "name": user_data.name,
        "role": user_data.role,
        "client_id": user_data.client_id,
        "vendor_id": user_data.vendor_id,
        "status": user_data.status,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    
    # Return user without password_hash
    del user["password_hash"]
    if "_id" in user:
        del user["_id"]
    
    # Add client name
    if user.get("client_id"):
        client = await db.clients.find_one({"id": user["client_id"]}, {"_id": 0, "name": 1})
        user["client_name"] = client["name"] if client else "Unknown"
    else:
        user["client_name"] = None
    
    return user

@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str, current_user: dict = Depends(get_client_admin_or_above)):
    """Get a specific user"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Client admin can only see users in their client
    if current_user.get("role") == "client_admin":
        if user.get("client_id") != current_user.get("client_id"):
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Add client name
    if user.get("client_id"):
        client = await db.clients.find_one({"id": user["client_id"]}, {"_id": 0, "name": 1})
        user["client_name"] = client["name"] if client else "Unknown"
    else:
        user["client_name"] = None
    
    return user

@api_router.put("/users/{user_id}", response_model=User)
async def update_user(user_id: str, user_data: UserUpdate, current_user: dict = Depends(get_client_admin_or_above)):
    """Update a user"""
    # Get existing user
    existing_user = await db.users.find_one({"id": user_id})
    if not existing_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Client admin can only update users in their client
    if current_user.get("role") == "client_admin":
        if existing_user.get("client_id") != current_user.get("client_id"):
            raise HTTPException(status_code=403, detail="Access denied")
        # Client admin cannot change role to super_admin
        if user_data.role == "system_admin":
            raise HTTPException(status_code=403, detail="Cannot set system_admin role")
        # Client admin cannot change client_id
        if user_data.client_id and user_data.client_id != current_user.get("client_id"):
            raise HTTPException(status_code=403, detail="Cannot change client assignment")
    
    update_data = {k: v for k, v in user_data.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    # If email is being updated, check for duplicates
    if "email" in update_data:
        update_data["email"] = normalize_email(update_data["email"])
        existing = await db.users.find_one({
            **email_case_insensitive_filter(update_data["email"]),
            "id": {"$ne": user_id},
        })
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
    
    # If password is being updated, hash it
    if "password" in update_data:
        update_data["password_hash"] = get_password_hash(update_data.pop("password"))
    
    # Validate role if being updated
    if "role" in update_data and update_data["role"] not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Use one of: {VALID_ROLES}")
    
    result = await db.users.update_one({"id": user_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    
    # Add client name
    if user.get("client_id"):
        client = await db.clients.find_one({"id": user["client_id"]}, {"_id": 0, "name": 1})
        user["client_name"] = client["name"] if client else "Unknown"
    else:
        user["client_name"] = None
    
    return user

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_client_admin_or_above)):
    """Delete a user"""
    # Prevent deleting yourself
    if current_user["id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    # Get user to check access
    user_to_delete = await db.users.find_one({"id": user_id})
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Client admin can only delete users in their client
    if current_user.get("role") == "client_admin":
        if user_to_delete.get("client_id") != current_user.get("client_id"):
            raise HTTPException(status_code=403, detail="Access denied")
        # Cannot delete super_admin
        if user_to_delete.get("role") in ("system_admin", "super_admin", "admin"):
            raise HTTPException(status_code=403, detail="Cannot delete system admin")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted successfully"}

# ============ CLIENT USER MANAGEMENT ENDPOINTS ============

@api_router.get("/clients/{client_id}/users", response_model=List[User])
async def get_client_users(client_id: str, current_user: dict = Depends(get_client_admin_or_above)):
    """Get all users for a specific client"""
    # Verify client exists
    client = await db.clients.find_one({"id": client_id})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Check access
    if not can_access_client(current_user, client_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    users = await db.users.find(
        {"client_id": client_id}, 
        {"_id": 0, "password_hash": 0}
    ).to_list(1000)
    
    # Add client name
    for user in users:
        user["client_name"] = client["name"]
    
    return users

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


class ArabicNameRequest(BaseModel):
    first_name_en: str
    father_name_en: Optional[str] = None
    grandfather_name_en: Optional[str] = None
    surname_en: Optional[str] = None
    mother_name_en: Optional[str] = None


class ArabicNameResponse(BaseModel):
    first_name_ar: Optional[str] = None
    father_name_ar: Optional[str] = None
    grandfather_name_ar: Optional[str] = None
    surname_ar: Optional[str] = None
    mother_name_ar: Optional[str] = None
    arabic_names_suggested: bool = True


@api_router.post("/utilities/generate-arabic-names", response_model=ArabicNameResponse)
async def generate_arabic_names(
    data: ArabicNameRequest,
    current_user: dict = Depends(get_current_user),
):
    """Convert English names to Arabic script (transliteration, not translation)."""
    arabic_names = ArabicNameGenerator.transliterate_full_name(
        first_name_en=data.first_name_en,
        father_name_en=data.father_name_en,
        grandfather_name_en=data.grandfather_name_en,
        surname_en=data.surname_en,
        mother_name_en=data.mother_name_en,
    )
    return ArabicNameResponse(**arabic_names)


@api_router.post("/utilities/generate-arabic-names/bulk", response_model=List[ArabicNameResponse])
async def generate_arabic_names_bulk(
    names: List[ArabicNameRequest],
    current_user: dict = Depends(get_current_user),
):
    results = []
    for name in names:
        arabic_names = ArabicNameGenerator.transliterate_full_name(
            first_name_en=name.first_name_en,
            father_name_en=name.father_name_en,
            grandfather_name_en=name.grandfather_name_en,
            surname_en=name.surname_en,
            mother_name_en=name.mother_name_en,
        )
        results.append(ArabicNameResponse(**arabic_names))
    return results


@api_router.post("/ocr/scan-passport", response_model=OCRResult)
async def scan_passport(
    image: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Scan passport image and extract data using EasyOCR"""
    image_data = await image.read()

    try:
        def process_image():
            mrz_text, visual_text = extract_all_text_from_image(image_data)
            combined = "\n".join(part for part in (mrz_text, visual_text) if part)
            parsed = parse_passport_text(combined)
            return combined, map_extracted_fields(parsed)

        raw_text, extracted_data = await asyncio.to_thread(process_image)

        if not raw_text.strip():
            return OCRResult(
                success=False,
                error="No text detected in image"
            )

        return OCRResult(
            success=True,
            extracted_data=extracted_data,
            raw_text=raw_text
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

register_enterprise_routes(api_router, db, get_current_user, verify_group_access, get_user_group_filter)
register_accounting_routes(api_router, db, get_current_user)

app.include_router(api_router)

@app.on_event("startup")
async def startup_event():
    await run_migrations(db)
    logging.info("Enterprise migrations completed")
    await asyncio.to_thread(warmup_reader)
    logging.info("EasyOCR reader warmed up")

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
