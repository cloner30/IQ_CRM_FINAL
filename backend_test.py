import requests
import sys
import json
from datetime import datetime

class PassportAPITester:
    def __init__(self, base_url="https://passport-manager-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.group_id = None
        self.passport_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'} if not files else {}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_get_groups_empty(self):
        """Test getting groups when empty"""
        success, response = self.run_test(
            "Get Groups (Empty)",
            "GET",
            "groups",
            200
        )
        return success

    def test_create_group(self):
        """Test creating a new group"""
        group_data = {
            "name": "Travel Group A",
            "description": "Visa application group"
        }
        success, response = self.run_test(
            "Create Group",
            "POST",
            "groups",
            200,
            data=group_data
        )
        if success and 'id' in response:
            self.group_id = response['id']
            print(f"   Created group with ID: {self.group_id}")
        return success

    def test_get_group_by_id(self):
        """Test getting a specific group"""
        if not self.group_id:
            print("❌ Skipped - No group ID available")
            return False
        
        success, response = self.run_test(
            "Get Group by ID",
            "GET",
            f"groups/{self.group_id}",
            200
        )
        return success

    def test_get_groups_with_data(self):
        """Test getting groups when data exists"""
        success, response = self.run_test(
            "Get Groups (With Data)",
            "GET",
            "groups",
            200
        )
        return success

    def test_get_passports_empty(self):
        """Test getting passports for a group when empty"""
        if not self.group_id:
            print("❌ Skipped - No group ID available")
            return False
        
        success, response = self.run_test(
            "Get Passports (Empty)",
            "GET",
            f"groups/{self.group_id}/passports",
            200
        )
        return success

    def test_create_passport(self):
        """Test creating a new passport"""
        if not self.group_id:
            print("❌ Skipped - No group ID available")
            return False
        
        passport_data = {
            "passport_no": "AB1234567",
            "passport_type": "Normal",
            "first_name_en": "John",
            "surname_en": "Doe",
            "first_name_ar": "جون",
            "nationality": "American",
            "gender": "Male",
            "expiry_date": "2030-12-31"
        }
        success, response = self.run_test(
            "Create Passport",
            "POST",
            f"groups/{self.group_id}/passports",
            200,
            data=passport_data
        )
        if success and 'id' in response:
            self.passport_id = response['id']
            print(f"   Created passport with ID: {self.passport_id}")
        return success

    def test_create_passport_with_new_fields(self):
        """Test creating a passport with all new fields (mother info, residence, applicant type)"""
        if not self.group_id:
            print("❌ Skipped - No group ID available")
            return False
        
        passport_data = {
            "passport_no": "NF9876543",
            "passport_type": "Normal",
            "first_name_en": "Sarah",
            "surname_en": "Ahmed",
            "first_name_ar": "سارة",
            "surname_ar": "أحمد",
            "father_name_en": "Mohammed",
            "father_name_ar": "محمد",
            "grandfather_name_en": "Ali",
            "grandfather_name_ar": "علي",
            # New mother information fields
            "mother_name_en": "Fatima",
            "mother_name_ar": "فاطمة",
            "mother_father_name_en": "Hassan",
            "mother_father_name_ar": "حسن",
            "nationality": "Iraqi",
            "gender": "Female",
            "birth_date": "1990-05-15",
            "place_of_issue": "Baghdad",
            "issue_date": "2020-01-01",
            "expiry_date": "2030-01-01",
            "profession": "Engineer",
            # New additional fields
            "country_of_residence": "United Arab Emirates",
            "applicant_type": "Daughter"
        }
        success, response = self.run_test(
            "Create Passport with New Fields",
            "POST",
            f"groups/{self.group_id}/passports",
            200,
            data=passport_data
        )
        if success and 'id' in response:
            self.new_passport_id = response['id']
            print(f"   Created passport with new fields, ID: {self.new_passport_id}")
            
            # Verify all new fields are present in response
            new_fields = ['mother_name_en', 'mother_name_ar', 'mother_father_name_en', 
                         'mother_father_name_ar', 'country_of_residence', 'applicant_type']
            missing_fields = []
            for field in new_fields:
                if field not in response or response[field] != passport_data[field]:
                    missing_fields.append(field)
            
            if missing_fields:
                print(f"❌ Missing or incorrect new fields in response: {missing_fields}")
                return False
            else:
                print(f"✅ All new fields correctly saved and returned")
        return success

    def test_get_passport_by_id(self):
        """Test getting a specific passport"""
        if not self.group_id or not self.passport_id:
            print("❌ Skipped - No group/passport ID available")
            return False
        
        success, response = self.run_test(
            "Get Passport by ID",
            "GET",
            f"groups/{self.group_id}/passports/{self.passport_id}",
            200
        )
        return success

    def test_get_passports_with_data(self):
        """Test getting passports when data exists"""
        if not self.group_id:
            print("❌ Skipped - No group ID available")
            return False
        
        success, response = self.run_test(
            "Get Passports (With Data)",
            "GET",
            f"groups/{self.group_id}/passports",
            200
        )
        return success

    def test_update_passport(self):
        """Test updating a passport"""
        if not self.group_id or not self.passport_id:
            print("❌ Skipped - No group/passport ID available")
            return False
        
        update_data = {
            "profession": "Engineer"
        }
        success, response = self.run_test(
            "Update Passport",
            "PUT",
            f"groups/{self.group_id}/passports/{self.passport_id}",
            200,
            data=update_data
        )
        return success

    def test_create_duplicate_passport(self):
        """Test creating a duplicate passport (should fail)"""
        if not self.group_id:
            print("❌ Skipped - No group ID available")
            return False
        
        passport_data = {
            "passport_no": "AB1234567",  # Same as before
            "passport_type": "Normal",
            "first_name_en": "Jane",
            "surname_en": "Smith",
            "nationality": "British",
            "gender": "Female",
            "expiry_date": "2029-12-31"
        }
        success, response = self.run_test(
            "Create Duplicate Passport (Should Fail)",
            "POST",
            f"groups/{self.group_id}/passports",
            400,  # Should fail with 400
            data=passport_data
        )
        return success

    def test_delete_passport(self):
        """Test deleting a passport"""
        if not self.group_id or not self.passport_id:
            print("❌ Skipped - No group/passport ID available")
            return False
        
        success, response = self.run_test(
            "Delete Passport",
            "DELETE",
            f"groups/{self.group_id}/passports/{self.passport_id}",
            200
        )
        return success

    def test_update_group(self):
        """Test updating a group"""
        if not self.group_id:
            print("❌ Skipped - No group ID available")
            return False
        
        update_data = {
            "name": "Updated Travel Group A",
            "description": "Updated visa application group"
        }
        success, response = self.run_test(
            "Update Group",
            "PUT",
            f"groups/{self.group_id}",
            200,
            data=update_data
        )
        return success

    def test_export_csv(self):
        """Test CSV export functionality"""
        if not self.group_id:
            print("❌ Skipped - No group ID available")
            return False
        
        success, response = self.run_test(
            "Export CSV",
            "GET",
            f"groups/{self.group_id}/export/csv",
            200
        )
        return success

    def test_download_template(self):
        """Test download Excel template"""
        success, response = self.run_test(
            "Download Excel Template",
            "GET",
            "templates/passport-import",
            200
        )
        return success

    def test_bulk_import_excel(self):
        """Test bulk import Excel functionality"""
        if not self.group_id:
            print("❌ Skipped - No group ID available")
            return False
        
        # Create a simple CSV content for testing
        csv_content = """passport_no,first_name_en,surname_en,nationality,expiry_date
XY9876543,Alice,Johnson,Canadian,2031-12-31
ZZ1111111,Bob,Wilson,Australian,2032-06-30"""
        
        files = {'file': ('test_import.csv', csv_content, 'text/csv')}
        
        success, response = self.run_test(
            "Bulk Import Excel/CSV",
            "POST",
            f"groups/{self.group_id}/import/excel",
            200,
            files=files
        )
        return success

    def test_delete_group(self):
        """Test deleting a group"""
        if not self.group_id:
            print("❌ Skipped - No group ID available")
            return False
        
        success, response = self.run_test(
            "Delete Group",
            "DELETE",
            f"groups/{self.group_id}",
            200
        )
        return success

    def test_get_nonexistent_group(self):
        """Test getting a non-existent group"""
        success, response = self.run_test(
            "Get Non-existent Group",
            "GET",
            "groups/nonexistent-id",
            404
        )
        return success

    def test_get_nonexistent_passport(self):
        """Test getting a non-existent passport"""
        if not self.group_id:
            print("❌ Skipped - No group ID available")
            return False
        
        success, response = self.run_test(
            "Get Non-existent Passport",
            "GET",
            f"groups/{self.group_id}/passports/nonexistent-id",
            404
        )
        return success

def main():
    print("🚀 Starting Passport Control Admin API Tests")
    print("=" * 60)
    
    tester = PassportAPITester()
    
    # Test sequence
    tests = [
        tester.test_root_endpoint,
        tester.test_get_groups_empty,
        tester.test_create_group,
        tester.test_get_group_by_id,
        tester.test_get_groups_with_data,
        tester.test_get_passports_empty,
        tester.test_create_passport,
        tester.test_get_passport_by_id,
        tester.test_get_passports_with_data,
        tester.test_update_passport,
        tester.test_export_csv,
        tester.test_download_template,
        tester.test_bulk_import_excel,
        tester.test_create_duplicate_passport,
        tester.test_delete_passport,
        tester.test_update_group,
        tester.test_get_nonexistent_group,
        tester.test_get_nonexistent_passport,
        tester.test_delete_group,
    ]
    
    # Run all tests
    for test in tests:
        test()
    
    # Print results
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"❌ {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())