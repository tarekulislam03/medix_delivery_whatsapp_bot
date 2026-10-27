# Medix Pharmacy Delivery - Button-Driven WhatsApp Bot

Production-ready, **button-driven and rule-based** Node.js (Express) WhatsApp order-automation server for **Medix Pharmacy Delivery** (similar to Flipkart's WhatsApp bot).

> **NO AI / LLM is used.** All interactions use Meta WhatsApp Cloud API **Interactive Messages** (reply buttons, list messages) and native location pins for a fast, deterministic, and error-free customer experience.

---

## Tech Stack & Highlights

- **Runtime**: Node.js 20+, Express
- **WhatsApp Cloud API**: Official Meta Graph API v21.0
- **Database & Storage**: Google Sheets API (tab `Orders` & tab `Support`) and Google Drive API (prescriptions, voice notes, strip photos) via Google Service Account
- **Logging & Security**: Pino structured logger with credential redaction, HMAC-SHA256 signature verification, and per-user rate limiting (20 msgs/min)
- **Multi-language**: English, Bengali (বাংলা), and Hindi (हिन्दी) with language selection stored per session
- **Reliability**: Per-user sequential queuing to prevent race conditions, 30s session disk persistence (`sessions.json`), and failed orders fallback (`failed-orders.json`) with automatic background retry

---

## WhatsApp Cloud API Limits Respected

- **Reply Buttons**: Max 3 buttons, title max 20 chars
- **List Messages**: Max 10 rows, row title max 24 chars, row description max 72 chars, list button label max 20 chars
- **Body Text**: Max 1024 chars

---

## State Machine Conversation Flow

```
[ Incoming Message ]
         │
         ▼
[ Language Check ] ──(If new)──► Buttons: [English] [বাংলা] [हिन्दी]
         │
         ▼
[ MAIN MENU ] ──► Buttons: [Order Medicine] [Track Order] [Talk to Team]
         │
         ├──► [Talk to Team] ──► Log in "Support" sheet + Optional admin alert + [Back to menu]
         │
         ├──► [Track Order] ──► Shows customer's last 3 orders or asks for Order ID
         │
         └──► [Order Medicine]
                 │
                 ▼
          List Message: "How would you like to order?"
          ├── 1. Type medicine name    (state: WAIT_TEXT_ORDER)
          ├── 2. Upload prescription   (state: WAIT_PRESCRIPTION -> [Add more] / [Done])
          ├── 3. Send voice message    (state: WAIT_VOICE -> uploads audio to Drive)
          ├── 4. Send strip photo      (state: WAIT_STRIP -> [Add more] / [Done])
          └── 5. Back to menu
                 │
                 ▼
          [ Details Collection ]
          ├── ASK_NAME: Validates min 2 chars
          ├── ASK_ADDRESS: Accepts text (min 10 chars) OR WhatsApp Location Pin (generates Google Maps link & asks landmark)
          └── ASK_PHONE: Buttons [Use WhatsApp No.] [Enter Other No.] (validates Indian 10-digit number)
                 │
                 ▼
          [ CONFIRM ORDER ]
          Summary + Buttons: [Confirm Order] [Edit Details] [Cancel]
          ├── Edit Details -> List: Name, Address, Phone, Medicines (updates and returns to Confirm)
          ├── Cancel -> Clears session, returns to Main Menu
          └── Confirm Order -> Saves to Google Sheets ("Orders" tab)
                  └── Reply: "Thank you! Your order ID is MDX-YYMMDD-XXXX. We'll confirm the price very soon."
                      Buttons: [Order Again] [Track Order]
```

---

## Project Structure

```
.
├── src/
│   ├── index.js               # Express app, middleware, health check, graceful shutdown
│   ├── routes/
│   │   ├── webhook.js         # GET/POST /webhook with HMAC validation & deduplication
│   │   └── notify.js          # POST /notify price confirmation endpoint
│   ├── flow/
│   │   ├── states.js          # State machine enum definitions
│   │   ├── messages.js        # Multi-language copy (EN, BN, HI) respecting API limits
│   │   └── handlers.js        # State transition dispatchers and order handlers
│   ├── services/
│   │   ├── whatsapp.js        # WhatsApp Graph API client (buttons, lists, templates, media)
│   │   ├── sheets.js          # Google Sheets integration (Orders & Support tabs, 3x retries)
│   │   ├── drive.js           # Google Drive file upload service
│   │   ├── session.js         # In-memory session store with 30s disk persistence
│   │   └── googleAuth.js      # Unified Service Account credential resolver
│   └── utils/
│       ├── logger.js          # Pino logger with credential redaction
│       └── validators.js      # Indian phone, name, address, and Order ID validators
├── templates/
│   └── price_confirmed_template.json # Meta WhatsApp message template specification
├── tests/
│   ├── stateMachine.test.js   # Unit tests for flow state transitions
│   ├── validators.test.js     # Unit tests for phone, name, and address validators
│   └── webhook.test.js        # Unit tests for signature verification
├── .env.example
├── package.json
└── README.md
```

---

## Google Sheets Layout

### Tab: `Orders`
| Col | Header | Description |
|---|---|---|
| **A** | `Order ID` | `MDX-YYMMDD-XXXX` (random 4 alphanumeric chars) |
| **B** | `Timestamp (IST)` | Indian Standard Time (`YYYY-MM-DD HH:mm:ss`) |
| **C** | `WhatsApp Number` | Customer's WhatsApp phone number |
| **D** | `Customer Name` | Extracted customer full name |
| **E** | `Phone` | Contact number (normalised 10-digit) |
| **F** | `Address` | Complete delivery address + landmark |
| **G** | `Map Link` | Google Maps URL (if location pin was shared) |
| **H** | `Order Type` | `Text Order` / `Prescription` / `Voice Message` / `Strip Photo` |
| **I** | `Medicines (text)` | Medicine list or media status description |
| **J** | `File Links` | Comma-separated Google Drive links |
| **K** | `Status` | Defaults to `Pending price confirmation` |
| **L** | `Price` | Empty initially; pharmacist fills in manually |
| **M** | `Notes` | Additional customer notes |

### Tab: `Support`
| Col | Header | Description |
|---|---|---|
| **A** | `Timestamp (IST)` | Timestamp when customer tapped "Talk to Team" |
| **B** | `WhatsApp Number` | Customer's WhatsApp phone number |
| **C** | `Note` | Support reason / status |

---

## Price-Confirmed Notification Feature (`POST /notify`)

When the pharmacist verifies the prescription/order and calculates the total price:

1. The pharmacist enters the price in Column L of the Google Sheet.
2. A webhook calls `POST /notify` with:
   - Header: `x-api-key: <NOTIFY_API_KEY>`
   - Body: `{ "orderId": "MDX-261027-A1B2" }`
3. The server retrieves the customer's phone number and sends an approved **Meta WhatsApp Template Message** with the price and buttons:
   - `[Confirm Delivery]`
   - `[Cancel Order]`

### Meta Template Specification (`templates/price_confirmed_template.json`)
Submit this template in [Meta WhatsApp Business Manager](https://business.facebook.com/wa/manage/message-templates/):

- **Template Name**: `medix_price_confirmation`
- **Category**: `UTILITY`
- **Language**: `en` (also add `bn`, `hi` if desired)
- **Header**: Text: `Medix Pharmacy Delivery`
- **Body**: `Hello {{1}}, the price for your medicine order {{2}} has been confirmed: {{3}}. Please confirm if you would like us to proceed with delivery.`
- **Footer**: `Medix Pharmacy - Delivering Health to Your Doorstep`
- **Buttons**: Quick reply buttons:
  - Button 1: `Confirm Delivery`
  - Button 2: `Cancel Order`

### Optional Google Apps Script for Sheet Trigger

Paste this in your Google Sheet under **Extensions** > **Apps Script**:

```javascript
function onEdit(e) {
  var sheet = e.source.getActiveSheet();
  if (sheet.getName() !== "Orders") return;

  var range = e.range;
  var col = range.getColumn(); // Column 12 is Column L (Price)
  var row = range.getRow();

  if (col === 12 && row > 1) {
    var price = range.getValue();
    var orderId = sheet.getRange(row, 1).getValue(); // Column A is Order ID

    if (price && orderId) {
      var payload = JSON.stringify({ orderId: orderId });
      var options = {
        method: "post",
        contentType: "application/json",
        headers: { "x-api-key": "YOUR_NOTIFY_API_KEY" },
        payload: payload,
        muteHttpExceptions: true
      };

      try {
        UrlFetchApp.fetch("https://your-server-domain.com/notify", options);
      } catch (err) {
        Logger.log("Notify error: " + err);
      }
    }
  }
}
```

---

## Step-by-Step Setup Guides

### 1. Meta WhatsApp Cloud API Setup
1. Log in to [Meta for Developers](https://developers.facebook.com/) and create a Business App.
2. Add **WhatsApp** product.
3. In **API Setup**:
   - Copy your **Phone Number ID**.
   - Generate a permanent System User token in Meta Business Suite with `whatsapp_business_messaging` permissions and set it as `WHATSAPP_TOKEN`.
4. In App Settings > **Basic**, copy your **App Secret** (`WHATSAPP_APP_SECRET`).
5. In **WhatsApp** > **Configuration**:
   - Callback URL: `https://your-domain.com/webhook`
   - Verify Token: Any secure token string you set as `WHATSAPP_VERIFY_TOKEN`.
   - Subscribe to the **`messages`** webhook field.

### 2. Google Cloud Service Account Setup
1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **Google Sheets API** and **Google Drive API**.
3. Create a Service Account (e.g. `medix-bot@your-project.iam.gserviceaccount.com`).
4. Generate a JSON Key and save it as `service-account.json` in the project root.
5. **Share the Google Sheet**: Create a Google Sheet named `Medix Orders`. Share it with your service account email as **Editor**. Copy the Sheet ID from the URL (`/d/<GOOGLE_SHEET_ID>/edit`).
6. **Share the Google Drive Folder**: Create a Google Drive folder for prescription uploads. Share it with your service account email as **Editor**. Copy the Folder ID from the URL (`/drive/folders/<GOOGLE_DRIVE_FOLDER_ID>`).

### 3. Local Testing with ngrok
1. Copy `.env.example` to `.env` and fill in credentials:
   ```bash
   cp .env.example .env
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. In another terminal, start ngrok:
   ```bash
   ngrok http 3000
   ```
4. Update the Webhook Callback URL in Meta Developers Console: `https://<ngrok-subdomain>.ngrok-free.app/webhook`.
5. Send a WhatsApp message to your test number from your mobile device!

### 4. Production VPS Deployment (PM2 + Nginx + Let's Encrypt)

```bash
# 1. Install Node.js 20, PM2, and Nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx
sudo npm install -g pm2

# 2. Clone repo and install dependencies
git clone <repo-url> /var/www/medix-bot
cd /var/www/medix-bot
npm install --omit=dev
cp .env.example .env
nano .env

# 3. Start with PM2
pm2 start src/index.js --name "medix-whatsapp-bot"
pm2 save
pm2 startup

# 4. Configure Nginx reverse proxy
sudo nano /etc/nginx/sites-available/medix-bot
```

Nginx configuration block:
```nginx
server {
    server_name bot.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site and acquire SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/medix-bot /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d bot.yourdomain.com
```

---

## Running Unit Tests

Run the complete test suite verifying validators, state transitions, and webhook signatures:

```bash
npm test
```

Expected result:
```
✔ stateMachine - language selection sets session.lang and transitions to MAIN_MENU
✔ stateMachine - MAIN_MENU to SELECT_ORDER_TYPE on menu_order
✔ stateMachine - SELECT_ORDER_TYPE to WAIT_TEXT_ORDER on opt_text
✔ stateMachine - complete text order flow to CONFIRM
✔ stateMachine - location pin support in ASK_ADDRESS transitions to ASK_LANDMARK
✔ stateMachine - global keyword cancel resets order to MAIN_MENU
✔ stateMachine - confirm_order saves to sheet and resets session to MAIN_MENU
✔ validateIndianPhone - valid numbers
✔ validateIndianPhone - invalid numbers
✔ validateName - validates min 2 chars
✔ validateAddress - validates min 10 chars
✔ validateOrderId - checks MDX-YYMMDD-XXXX pattern
✔ webhook - verifySignature returns true for valid HMAC SHA-256 signature
✔ webhook - verifySignature returns false for mismatched signature
✔ webhook - verifySignature returns false when signature header is missing

ℹ tests 15
ℹ pass 15
ℹ fail 0
```

---

## Health Check Endpoint

Check the live status of the service:

```bash
curl http://localhost:3000/health
```

Output:
```json
{
  "status": "ok",
  "uptime": 360,
  "timestamp": "2026-10-27T01:15:00.000Z",
  "service": "Medix Pharmacy WhatsApp Bot"
}
```

---

## License

ISC License. Built for Medix Pharmacy Delivery.
