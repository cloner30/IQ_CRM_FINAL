from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse
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
import shutil
import aiofiles

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create uploads directory
UPLOADS_DIR = ROOT_DIR / 'uploads'
PASSPORT_UPLOADS = UPLOADS_DIR / 'passports'
PHOTO_UPLOADS = UPLOADS_DIR / 'photos'
PASSPORT_UPLOADS.mkdir(parents=True, exist_ok=True)
PHOTO_UPLOADS.mkdir(parents=True, exist_ok=True)

# Allowed file extensions
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg'}

app = FastAPI()
api_router = APIRouter(prefix="/api")

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
    name: str
    nationality: str
    expiry_date: str

class Passport(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    group_id: str
    passport_no: str
    name: str
    nationality: str
    expiry_date: str
    passport_image: Optional[str] = None
    profile_image: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PassportUpdate(BaseModel):
    passport_no: Optional[str] = None
    name: Optional[str] = None
    nationality: Optional[str] = None
    expiry_date: Optional[str] = None

def validate_file_extension(filename: str) -> bool:
    ext = Path(filename).suffix.lower()
    return ext in ALLOWED_EXTENSIONS

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
    # Delete all passports in the group
    await db.passports.delete_many({"group_id": group_id})
    result = await db.groups.delete_one({"id": group_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Group not found")
    return {"message": "Group deleted successfully"}

# Passport endpoints
@api_router.get("/groups/{group_id}/passports", response_model=List[Passport])
async def get_passports(group_id: str):
    passports = await db.passports.find({"group_id": group_id}, {"_id": 0}).to_list(1000)
    return passports

@api_router.post("/groups/{group_id}/passports", response_model=Passport)
async def create_passport(group_id: str, passport_data: PassportCreate):
    # Verify group exists
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check if passport number already exists in this group
    existing = await db.passports.find_one({
        "group_id": group_id,
        "passport_no": passport_data.passport_no.upper()
    })
    if existing:
        raise HTTPException(status_code=400, detail="Passport number already exists in this group")
    
    passport = Passport(
        group_id=group_id,
        passport_no=passport_data.passport_no.upper(),
        name=passport_data.name,
        nationality=passport_data.nationality,
        expiry_date=passport_data.expiry_date
    )
    
    # Check if images already exist for this passport number
    passport_img = PASSPORT_UPLOADS / group_id / f"{passport.passport_no}.jpg"
    photo_img = PHOTO_UPLOADS / group_id / f"{passport.passport_no}.jpg"
    
    if passport_img.exists():
        passport.passport_image = f"/api/uploads/passports/{group_id}/{passport.passport_no}.jpg"
    if photo_img.exists():
        passport.profile_image = f"/api/uploads/photos/{group_id}/{passport.passport_no}.jpg"
    
    doc = passport.model_dump()
    await db.passports.insert_one(doc)
    
    # Update group passport count
    await db.groups.update_one(
        {"id": group_id},
        {"$inc": {"passport_count": 1}}
    )
    
    return passport

@api_router.put("/groups/{group_id}/passports/{passport_id}", response_model=Passport)
async def update_passport(group_id: str, passport_id: str, passport_data: PassportUpdate):
    update_data = {k: v for k, v in passport_data.model_dump().items() if v is not None}
    if "passport_no" in update_data:
        update_data["passport_no"] = update_data["passport_no"].upper()
    
    result = await db.passports.update_one(
        {"id": passport_id, "group_id": group_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Passport not found")
    passport = await db.passports.find_one({"id": passport_id}, {"_id": 0})
    return passport

@api_router.delete("/groups/{group_id}/passports/{passport_id}")
async def delete_passport(group_id: str, passport_id: str):
    result = await db.passports.delete_one({"id": passport_id, "group_id": group_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Passport not found")
    
    # Update group passport count
    await db.groups.update_one(
        {"id": group_id},
        {"$inc": {"passport_count": -1}}
    )
    
    return {"message": "Passport deleted successfully"}

# Bulk upload endpoints
@api_router.post("/groups/{group_id}/upload/passports")
async def bulk_upload_passports(group_id: str, files: List[UploadFile] = File(...)):
    # Verify group exists
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    group_dir = PASSPORT_UPLOADS / group_id
    group_dir.mkdir(parents=True, exist_ok=True)
    
    results = {"success": [], "failed": [], "mapped": []}
    
    for file in files:
        if not validate_file_extension(file.filename):
            results["failed"].append({"filename": file.filename, "reason": "Invalid file type. Only JPG/JPEG allowed."})
            continue
        
        passport_no = extract_passport_number(file.filename)
        file_path = group_dir / f"{passport_no}.jpg"
        
        try:
            async with aiofiles.open(file_path, 'wb') as out_file:
                content = await file.read()
                await out_file.write(content)
            
            results["success"].append({"filename": file.filename, "passport_no": passport_no})
            
            # Update passport record if exists
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
    # Verify group exists
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    group_dir = PHOTO_UPLOADS / group_id
    group_dir.mkdir(parents=True, exist_ok=True)
    
    results = {"success": [], "failed": [], "mapped": []}
    
    for file in files:
        if not validate_file_extension(file.filename):
            results["failed"].append({"filename": file.filename, "reason": "Invalid file type. Only JPG/JPEG allowed."})
            continue
        
        passport_no = extract_passport_number(file.filename)
        file_path = group_dir / f"{passport_no}.jpg"
        
        try:
            async with aiofiles.open(file_path, 'wb') as out_file:
                content = await file.read()
                await out_file.write(content)
            
            results["success"].append({"filename": file.filename, "passport_no": passport_no})
            
            # Update passport record if exists
            update_result = await db.passports.update_one(
                {"group_id": group_id, "passport_no": passport_no},
                {"$set": {"profile_image": f"/api/uploads/photos/{group_id}/{passport_no}.jpg"}}
            )
            if update_result.matched_count > 0:
                results["mapped"].append(passport_no)
                
        except Exception as e:
            results["failed"].append({"filename": file.filename, "reason": str(e)})
    
    return results

# Serve uploaded files
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

# Health check
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
