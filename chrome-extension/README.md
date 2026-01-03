# Iraq E-Visa Form Filler - Chrome Extension

This Chrome extension automatically fills the Iraq e-visa application form (https://eservice.evisa.iq/) with passport data from your Passport Control Admin application.

## Features

- **Group Selection**: Browse and select from your passenger groups
- **Passenger Selection**: Choose a specific passenger to fill the form
- **Auto-Fill**: One-click form filling with all passport data
- **Date Conversion**: Automatically converts dates to the required m/d/yyyy format
- **Smart Mapping**: Maps your data to the correct form fields

## Installation

### Method 1: Load Unpacked (Development)

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder
5. The extension will appear in your toolbar

### Method 2: Package for Distribution

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Pack extension"
4. Select the `chrome-extension` folder
5. This creates a `.crx` file for distribution

## Configuration

1. Click the extension icon in Chrome toolbar
2. Click "Settings" or the gear icon
3. Enter your Passport Control Admin API URL (e.g., `https://your-app.com`)
4. Click "Test Connection" to verify
5. Click "Save Settings"

## Usage

1. Navigate to https://eservice.evisa.iq/
2. Start a new visa application and reach the "Beneficiary Data" form
3. Click the extension icon
4. Select a group
5. Select a passenger
6. Click "Fill Form"
7. The form will be automatically populated with the passenger's data

## Field Mapping

The extension maps the following fields:

| Your App Field | E-Visa Form Field |
|----------------|-------------------|
| first_name_en | First Name - English |
| surname_en | Surname - English |
| father_name_en | Father Name - English |
| grandfather_name_en | Grandfather Name - English |
| first_name_ar | First Name - Arabic |
| surname_ar | Surname - Arabic |
| father_name_ar | Father Name - Arabic |
| grandfather_name_ar | Grandfather Name - Arabic |
| mother_name_en | Mother Name - English |
| mother_name_ar | Mother Name - Arabic |
| mother_father_name_en | Mother's Father Name - English |
| mother_father_name_ar | Mother's Father Name - Arabic |
| nationality | Nationality (dropdown) |
| gender | Gender (dropdown) |
| birth_date | Birth Date (m/d/yyyy) |
| profession | Profession (dropdown) |
| passport_no | Passport Number |
| passport_type | Passport Type (dropdown) |
| place_of_issue | Place of Issue (dropdown) |
| issue_date | Issuance Date (m/d/yyyy) |
| expiry_date | Expiry Date (m/d/yyyy) |
| country_of_residence | Country of Residence |
| applicant_type | Applicant Type |

## Troubleshooting

### "Failed to load groups"
- Check that your API URL is correct in settings
- Make sure your Passport Control Admin server is running
- Verify CORS is enabled on your server

### Form not filling
- Make sure you're on the correct page (Beneficiary Data form)
- Wait for the page to fully load before clicking "Fill Form"
- Check the browser console for error messages

### Dropdown values not matching
- Some dropdown values may not match exactly
- You may need to manually select these values

## Privacy

This extension:
- Only communicates with your configured server
- Does not collect or transmit any personal data
- Stores only your API URL in Chrome's sync storage

## License

This extension is part of the Passport Control Admin application.
