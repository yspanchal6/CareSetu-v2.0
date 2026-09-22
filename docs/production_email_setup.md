# CareSetu Production Email Delivery & Brevo IP Authorization Architecture Guide

## Overview & Architecture

CareSetu uses **Brevo REST API v3** for dispatching transactional email messages (Email OTP verification, password resets, and critical emergency alerts).

This guide details the production deployment requirements for resolving Brevo HTTP 401 (`unrecognised IP address`) errors, configuring outbound static egress NAT IPs, setting up domain authentication (SPF/DKIM), and enforcing security controls.

---

## 1. Root Cause of Brevo HTTP 401 ("Unrecognised IP Address")

### The Dynamic IP Problem
- When developers make API requests from local laptops or dynamic IP networks, their outbound public IP address changes whenever Wi-Fi reconnects, laptops reboot, or ISP DHCP leases expire.
- If **Brevo Authorized IPs** security protection is enabled on your Brevo account (`https://app.brevo.com/security/authorised_ips`), Brevo blocks API requests coming from unlisted IP addresses with:
  ```json
  {
    "message": "We have detected you are using an unrecognised IP address 152.59.36.170. If you performed this action make sure to add the new IP address in this link: https://app.brevo.com/security/authorised_ips",
    "code": "unauthorized"
  }
  ```

### Why Application Code Cannot Fix Dynamic Laptop IPs
Application code cannot fix a developer's changing home/mobile IP. Hardcoding IP addresses in application code is strictly prohibited. Production stability relies on deploying backend servers behind a **fixed static outbound egress NAT IP**.

---

## 2. Production Outbound Egress IP Architecture

In production, CareSetu backend servers run on dedicated cloud infrastructure with a stable, fixed outbound IP.

### Recommended Cloud Provider Egress Setup

1. **Google Cloud Platform (GCP Cloud Run / GKE):**
   - Attach a **Cloud NAT Gateway** to your Serverless VPC Access connector.
   - Assign a **Static External IP** to the Cloud NAT Gateway.
   - All outbound API calls from CareSetu to Brevo will originate from this single static IP address.

2. **Amazon Web Services (AWS ECS / EC2):**
   - Deploy backend tasks in private subnets routed through a **NAT Gateway**.
   - Attach an **Elastic IP (EIP)** to the NAT Gateway.
   - Register the Elastic IP in Brevo Authorized IPs.

3. **DigitalOcean / Linode / Vultr (Virtual Private Servers):**
   - Assign a **Reserved / Static IPv4 Address** to the application VPS instance.

### Registering Static Egress IP in Brevo
1. Log in to [Brevo Dashboard](https://app.brevo.com/).
2. Navigate to **Security & Privacy** → **Authorized IPs** ([https://app.brevo.com/security/authorised_ips](https://app.brevo.com/security/authorised_ips)).
3. Click **Add an IP Address**.
4. Enter your production server's fixed public egress IP (e.g., `203.0.113.50`).
5. Save the configuration.

---

## 3. Alternative: Disabling IP Whitelisting (Security Trade-Off)

If your backend is hosted on serverless platforms without static IP egress support (such as free-tier Vercel, Netlify Functions, or basic Render instances):

1. **Option A: Disable IP Restrictions in Brevo:**
   - In Brevo Authorized IPs settings, toggle off **IP Whitelisting**.
   - **Security Impact:** Any client possessing your `BREVO_API_KEY` can trigger email dispatches. Ensure `BREVO_API_KEY` is kept strictly secret in backend environment variables.
2. **Option B: Whitelist Cloud CIDR Ranges:**
   - Add your cloud provider's published outbound IP CIDR blocks to Brevo.

---

## 4. Sender Domain Authentication (SPF & DKIM)

To ensure email OTPs arrive directly in recipients' **Inbox** (rather than Spam/Junk folders):

### A. Custom Sender Domain
Do not use `@gmail.com` or `@yahoo.com` as production `BREVO_SENDER_EMAIL`. Public webmail domains violate strict DMARC policies when sent through third-party relays. Use a custom domain (e.g., `noreply@caresetu.in`).

### B. DNS Record Setup

1. **SPF Record (TXT):**
   Add or update the SPF record on your domain DNS:
   ```text
   v=spf1 include:spf.brevo.com ~all
   ```

2. **DKIM Record (TXT):**
   Copy the unique DKIM key generated in Brevo Dashboard (**Senders & IP** → **Domains**) and add a TXT record for `mail._domainkey.yourdomain.com`.

3. **DMARC Record (TXT):**
   Add a DMARC policy record:
   ```text
   _dmarc.yourdomain.com TXT "v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com"
   ```

---

## 5. Environment Variables & Security Controls

### Required Backend Environment Variables

```ini
# Production Environment Flag
NODE_ENV="production"

# Brevo API Configuration
BREVO_API_KEY="xkeysib-your-production-brevo-api-key"
BREVO_SENDER_EMAIL="noreply@caresetu.in"
BREVO_SENDER_NAME="CareSetu"

# Gating (Set ALLOW_DEV_OTP=false or omit in production)
ALLOW_DEV_OTP="false"
```

### Security Enforcement Controls
1. **Zero Plaintext OTP Logging:** Plain OTP codes are never logged to `stdout` or included in production responses (`devOtp` is omitted).
2. **Bounded Retries:** `brevo.provider.js` performs up to 2 retries with exponential backoff for transient server/network errors (HTTP 500, 502, 503, timeouts), while failing fast without retrying permanent HTTP 401/403 authentication failures.
3. **Database State Integrity:** Failed email dispatches return HTTP 502/401 and prevent the OTP record from being marked as verified (`verifiedAt` remains `null`).

---

## 6. Email Delivery Status & Tracking

- **`ACCEPTED_BY_PROVIDER` (HTTP 200/201):** Confirms Brevo REST API accepted the message into its SMTP delivery queue.
- **Provider Acceptance vs Inbox Delivery:** Provider acceptance confirms successful handoff to Brevo. Actual inbox placement depends on recipient ISP filters, domain reputation, and SPF/DKIM authentication.

---

## 7. Troubleshooting Guide

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **HTTP 401: Unrecognised IP** | Server IP not authorized in Brevo | Register server egress IP at `https://app.brevo.com/security/authorised_ips` |
| **HTTP 401: Key not found** | Invalid `BREVO_API_KEY` | Verify `BREVO_API_KEY` in backend `.env` |
| **HTTP 429: Rate Limit** | Sent too many requests | Wait 15 minutes or increase Brevo quota |
| **Emails landing in Spam** | Using `@gmail.com` sender or missing SPF/DKIM | Configure custom domain with SPF (`include:spf.brevo.com`) & DKIM in DNS |
| **HTTP 502: Delivery Failed** | Network timeout or provider outage | Automatic bounded retry will attempt re-dispatch; inspect server logs |
