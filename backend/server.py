from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import aiofiles
import pandas as pd
from io import BytesIO, StringIO
import csv
import boto3
from botocore.exceptions import ClientError

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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

class Group(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    passport_count: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PassportCreate(BaseModel):
    passport_no: str
    passport_type: Optional[str] = "Normal"
    first_name_en: str
    surname_en: str
    first_name_ar: Optional[str] = ""
    father_name_ar: Optional[str] = ""
    father_name_en: Optional[str] = ""
    grandfather_name_ar: Optional[str] = ""
    grandfather_name_en: Optional[str] = ""
    surname_ar: Optional[str] = ""
    mother_name_ar: Optional[str] = ""
    mother_name_en: Optional[str] = ""
    mother_father_name_ar: Optional[str] = ""
    mother_father_name_en: Optional[str] = ""
    nationality: str
    gender: Optional[str] = ""
    birth_date: Optional[str] = ""
    place_of_issue: Optional[str] = ""
    issue_date: Optional[str] = ""
    expiry_date: str
    profession: Optional[str] = ""
    country_of_residence: Optional[str] = ""
    applicant_type: Optional[str] = ""

class Passport(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    group_id: str
    passport_no: str
    passport_type: str = "Normal"
    first_name_en: str = ""
    surname_en: str = ""
    first_name_ar: str = ""
    father_name_ar: str = ""
    father_name_en: str = ""
    grandfather_name_ar: str = ""
    grandfather_name_en: str = ""
    surname_ar: str = ""
    mother_name_ar: str = ""
    mother_name_en: str = ""
    mother_father_name_ar: str = ""
    mother_father_name_en: str = ""
    nationality: str = ""
    gender: str = ""
    birth_date: str = ""
    place_of_issue: str = ""
    issue_date: str = ""
    expiry_date: str = ""
    profession: str = ""
    country_of_residence: str = ""
    applicant_type: str = ""
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
    status: Optional[str] = None

def validate_file_extension(filename: str) -> bool:
    ext = Path(filename).suffix.lower()
    return ext in ALLOWED_EXTENSIONS

def validate_excel_extension(filename: str) -> bool:
    ext = Path(filename).suffix.lower()
    return ext in EXCEL_EXTENSIONS

def extract_passport_number(filename: str) -> str:
    """Extract passport number from filename (without extension)"""
    return Path(filename).stem.upper()

# Group endpoints
@api_router.get("/groups", response_model=List[Group])
async def get_groups():
    groups = await db.groups.find({}, {"_id": 0}).to_list(1000)
    return groups

@api_router.post("/groups", response_model=Group)
async def create_group(group_data: GroupCreate):
    group = Group(**group_data.model_dump())
    doc = group.model_dump()
    await db.groups.insert_one(doc)
    return group

@api_router.get("/groups/{group_id}", response_model=Group)
async def get_group(group_id: str):
    group = await db.groups.find_one({"id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group

@api_router.put("/groups/{group_id}", response_model=Group)
async def update_group(group_id: str, group_data: GroupCreate):
    result = await db.groups.update_one(
        {"id": group_id},
        {"$set": group_data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Group not found")
    group = await db.groups.find_one({"id": group_id}, {"_id": 0})
    return group

@api_router.delete("/groups/{group_id}")
async def delete_group(group_id: str):
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
async def get_passports(group_id: str):
    passports = await db.passports.find({"group_id": group_id}, {"_id": 0}).to_list(1000)
    # Process S3 images to presigned URLs
    processed_passports = [process_passport_images(p) for p in passports]
    return processed_passports

@api_router.post("/groups/{group_id}/passports", response_model=Passport)
async def create_passport(group_id: str, passport_data: PassportCreate):
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
async def get_passport(group_id: str, passport_id: str):
    passport = await db.passports.find_one({"id": passport_id, "group_id": group_id}, {"_id": 0})
    if not passport:
        raise HTTPException(status_code=404, detail="Passport not found")
    # Process S3 images to presigned URLs
    return process_passport_images(passport)

@api_router.put("/groups/{group_id}/passports/{passport_id}", response_model=Passport)
async def update_passport(group_id: str, passport_id: str, passport_data: PassportUpdate):
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
async def delete_passport(group_id: str, passport_id: str):
    result = await db.passports.delete_one({"id": passport_id, "group_id": group_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Passport not found")
    
    await db.groups.update_one(
        {"id": group_id},
        {"$inc": {"passport_count": -1}}
    )
    
    return {"message": "Passport deleted successfully"}

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
        'country_of_residence', 'applicant_type', 'passport_image', 'profile_image'
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
