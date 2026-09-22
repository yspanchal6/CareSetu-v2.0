/**
 * CareSetu Brevo Email Service Provider
 * Handles transactional emails (OTP, credential update, emergency notifications)
 * via Brevo REST API v3 with dynamic configuration, DMARC checks, and delivery tracking.
 */

class BrevoProvider {
  get apiKey() {
    return process.env.BREVO_API_KEY;
  }

  get baseUrl() {
    return process.env.BREVO_BASE_URL || 'https://api.brevo.com';
  }

  get senderEmail() {
    return process.env.BREVO_SENDER_EMAIL;
  }

  get senderName() {
    return process.env.BREVO_SENDER_NAME || 'CareSetu';
  }

  /**
   * Safe email masking helper for logs
   */
  maskEmail(email) {
    if (!email || typeof email !== 'string' || !email.includes('@')) return 'not-set';
    const [name, domain] = email.split('@');
    if (name.length <= 2) return `${name[0]}***@${domain}`;
    return `${name[0]}***${name[name.length - 1]}@${domain}`;
  }

  /**
   * Safe configuration check without revealing secrets.
   */
  validateConfig() {
    const errors = [];
    const warnings = [];

    if (!this.apiKey || !this.apiKey.trim()) {
      errors.push('BREVO_API_KEY is not configured in environment variables.');
    }
    if (!this.senderEmail || !this.senderEmail.trim()) {
      errors.push('BREVO_SENDER_EMAIL is not configured in environment variables.');
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.senderEmail.trim())) {
        errors.push('BREVO_SENDER_EMAIL has an invalid email format.');
      }

      // Check DMARC warning for public webmail domains on third-party relays
      const domain = this.senderEmail.trim().split('@')[1]?.toLowerCase();
      if (['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com'].includes(domain)) {
        warnings.push(
          `Sender domain @${domain} uses strict DMARC/SPF policies. Emails sent via Brevo relay may be bounced by recipient servers. Use a verified custom domain for production delivery.`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      provider: 'brevo',
      senderEmailMasked: this.maskEmail(this.senderEmail),
    };
  }

  /**
   * Returns sanitized diagnostic info for administrators.
   */
  getDiagnostics() {
    const config = this.validateConfig();
    return {
      provider: 'brevo',
      configured: config.valid,
      errors: config.errors,
      warnings: config.warnings,
      senderMasked: config.senderEmailMasked,
      apiKeyConfigured: !!this.apiKey,
      environment: process.env.NODE_ENV || 'development',
    };
  }

  /**
   * Verifies API Key & IP Authorization with Brevo without sending an email.
   * Calls GET /v3/account endpoint.
   */
  async verifyBrevoAuth() {
    const config = this.validateConfig();
    if (!config.valid) {
      return {
        authenticated: false,
        status: 400,
        reason: `Configuration missing: ${config.errors.join('; ')}`,
        senderEmailMasked: config.senderEmailMasked,
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/v3/account`, {
        method: 'GET',
        headers: {
          'api-key': this.apiKey,
          'accept': 'application/json',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (!response.ok) {
        const text = await response.text();
        const ipMatch = text.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
        const ipStr = ipMatch ? ipMatch[0] : null;

        if (response.status === 401) {
          console.error(`[BREVO_PROVIDER] Diagnostic Auth Failure 401: Server IP (${ipStr || 'unknown'}) is not authorized or API key is invalid.`);
          return {
            authenticated: false,
            status: 401,
            reason: `Unauthorized (401): ${ipStr ? `Server IP ${ipStr} is not authorized in Brevo dashboard.` : 'Invalid API key or IP restriction.'}`,
            serverIpDetected: ipStr,
          };
        }

        return {
          authenticated: false,
          status: response.status,
          reason: `Brevo API HTTP ${response.status}: ${text.slice(0, 150)}`,
        };
      }

      const data = await response.json();
      return {
        authenticated: true,
        status: 200,
        accountEmail: this.maskEmail(data.email),
        planType: data.plan?.[0]?.type || 'Standard',
      };
    } catch (err) {
      console.error(`[BREVO_PROVIDER] Diagnostic Connection Error: ${err.message}`);
      return {
        authenticated: false,
        status: 500,
        reason: `Network/Timeout error connecting to Brevo: ${err.message}`,
      };
    }
  }

  /**
   * Sends transactional email via Brevo REST API v3 with safe error classification.
   * Zero secret or IP leakage in client-facing error strings.
   */
  async sendEmail({ to, subject, html, text }, maxRetries = 2) {
    if (!to || typeof to !== 'string' || !to.trim()) {
      return {
        success: false,
        provider: 'brevo',
        deliveryState: 'INVALID_RECIPIENT',
        error: 'Recipient email address is required.',
      };
    }

    const normalizedTo = to.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedTo)) {
      return {
        success: false,
        provider: 'brevo',
        deliveryState: 'INVALID_RECIPIENT',
        error: 'Invalid recipient email address format.',
      };
    }

    if (!subject || !subject.trim()) {
      return {
        success: false,
        provider: 'brevo',
        deliveryState: 'INVALID_INPUT',
        error: 'Email subject is required.',
      };
    }

    const config = this.validateConfig();
    if (!config.valid) {
      console.error(`[BREVO_PROVIDER] Missing or invalid configuration: ${config.errors.join('; ')}`);
      return {
        success: false,
        provider: 'brevo',
        deliveryState: 'CONFIG_ERROR',
        error: 'Email verification is temporarily unavailable. Please try again later.',
      };
    }

    const payload = {
      sender: {
        name: this.senderName,
        email: this.senderEmail.trim(),
      },
      to: [{ email: normalizedTo }],
      subject: subject.trim(),
      htmlContent: html || `<p>${text || subject}</p>`,
      textContent: text || subject,
    };

    let attempt = 0;
    while (attempt <= maxRetries) {
      attempt++;
      try {
        console.log(`[BREVO_PROVIDER] Dispatching email to ${this.maskEmail(normalizedTo)} (Attempt ${attempt}/${maxRetries + 1})`);

        const response = await fetch(`${this.baseUrl}/v3/smtp/email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': this.apiKey,
            'accept': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          const errorText = await response.text();

          // Diagnostic internal log (kept strictly on server console / logger)
          const ipMatch = errorText.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
          const ipStr = ipMatch ? ipMatch[0] : 'unknown';

          if (response.status === 401) {
            console.error(`[BREVO_PROVIDER] HTTP 401 Unauthorized: Server IP (${ipStr}) is not authorized or API key is invalid.`);
            console.error(`[BREVO_PROVIDER] Diagnostic hint: Whitelist ${ipStr} in Brevo dashboard: https://app.brevo.com/security/authorised_ips`);
            
            // Fast fail — DO NOT retry 401 authorization failure
            return {
              success: false,
              provider: 'brevo',
              status: 401,
              deliveryState: 'AUTH_FAILURE',
              error: 'Email verification is temporarily unavailable. Please try again later.',
            };
          }

          if (response.status === 403) {
            console.error(`[BREVO_PROVIDER] HTTP 403 Forbidden: Sender restriction or domain permission issue.`);
            return {
              success: false,
              provider: 'brevo',
              status: 403,
              deliveryState: 'FORBIDDEN',
              error: 'Email verification is temporarily unavailable. Please try again later.',
            };
          }

          if (response.status === 429) {
            console.warn(`[BREVO_PROVIDER] HTTP 429 Rate Limit Exceeded.`);
            return {
              success: false,
              provider: 'brevo',
              status: 429,
              deliveryState: 'RATE_LIMIT',
              error: 'Too many email requests. Please wait a few minutes before trying again.',
            };
          }

          if (response.status >= 500) {
            console.error(`[BREVO_PROVIDER] HTTP ${response.status} Provider Server Error.`);
            if (attempt <= maxRetries) {
              console.warn(`[BREVO_PROVIDER] Retrying transient 5xx error in ${attempt * 500}ms...`);
              await new Promise((resolve) => setTimeout(resolve, attempt * 500));
              continue;
            }
            return {
              success: false,
              provider: 'brevo',
              status: response.status,
              deliveryState: 'PROVIDER_SERVER_ERROR',
              error: 'Email service is temporarily unavailable. Please try again later.',
            };
          }

          return {
            success: false,
            provider: 'brevo',
            status: response.status,
            deliveryState: 'REJECTED_BY_PROVIDER',
            error: 'Email verification is temporarily unavailable. Please try again later.',
          };
        }

        const data = await response.json();
        console.log(`[BREVO_PROVIDER] Provider Accepted Email (MessageID: ${data.messageId || 'N/A'})`);

        return {
          success: true,
          provider: 'brevo',
          status: response.status,
          messageId: data.messageId || `brevo-${Date.now()}`,
          deliveryState: 'ACCEPTED_BY_PROVIDER',
          recipient: normalizedTo,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        const isTimeout = error.name === 'TimeoutError' || error.message?.includes('timeout');
        console.error(`[BREVO_PROVIDER] Network/Timeout Error (Attempt ${attempt}/${maxRetries + 1}): ${error.message}`);

        if (attempt <= maxRetries) {
          console.warn(`[BREVO_PROVIDER] Retrying transient network error in ${attempt * 500}ms...`);
          await new Promise((resolve) => setTimeout(resolve, attempt * 500));
          continue;
        }

        return {
          success: false,
          provider: 'brevo',
          deliveryState: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
          error: 'Email delivery timed out. Please try again.',
        };
      }
    }
  }
}

module.exports = new BrevoProvider();
