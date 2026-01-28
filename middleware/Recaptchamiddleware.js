// backend/middleware/recaptchaMiddleware.js
// ✅ reCAPTCHA v3 verification with SCORE-BASED checking

const axios = require('axios');

/**
 * Middleware to verify Google reCAPTCHA v3 token
 * v3 is INVISIBLE and uses score-based verification (0.0 - 1.0)
 * - 1.0 = Very likely a legitimate human
 * - 0.0 = Very likely a bot
 */
const verifyRecaptcha = async (req, res, next) => {
  const { recaptchaToken } = req.body;
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  console.log('🔍 reCAPTCHA v3 Middleware triggered');
  console.log('📝 Token received:', recaptchaToken ? 'YES ✅' : 'NO ❌');

  // ✅ Check if token is provided
  if (!recaptchaToken) {
    console.log('❌ Request blocked: No reCAPTCHA token provided');
    return res.status(400).json({
      success: false,
      message: 'reCAPTCHA verification required.',
    });
  }

  // ✅ Check if secret key is configured
  if (!secretKey) {
    console.error('⚠️ RECAPTCHA_SECRET_KEY not configured in environment variables');
    return res.status(500).json({
      success: false,
      message: 'Server configuration error. Please contact support.',
    });
  }

  console.log('🔄 Verifying token with Google reCAPTCHA v3...');

  try {
    // ✅ Verify token with Google
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: secretKey,
          response: recaptchaToken,
        },
        timeout: 5000, // 5 second timeout
      }
    );

    const { 
      success, 
      score, 
      action,
      challenge_ts, 
      hostname,
      'error-codes': errorCodes 
    } = response.data;

    // ✅ Log verification details (for debugging)
    console.log('📊 reCAPTCHA v3 verification result:', {
      success: success ? '✅ PASSED' : '❌ FAILED',
      score: score ? `${score} ${score >= 0.5 ? '(✅ Good)' : '(⚠️ Suspicious)'}` : 'N/A',
      action: action || 'N/A',
      timestamp: challenge_ts || 'N/A',
      hostname: hostname || 'N/A',
      errors: errorCodes || 'none',
    });

    // ✅ Check if verification was successful
    if (!success) {
      console.error('❌ reCAPTCHA verification FAILED');
      console.error('Error codes:', errorCodes);
      return res.status(400).json({
        success: false,
        message: 'reCAPTCHA verification failed. Please try again.',
        errors: errorCodes,
      });
    }

    // ✅ Check score (v3 SPECIFIC - THIS IS THE KEY DIFFERENCE FROM v2)
    // Score interpretation:
    // 0.9 - 1.0 = Very likely legitimate user ✅
    // 0.7 - 0.9 = Likely legitimate user ✅
    // 0.5 - 0.7 = Neutral ⚠️
    // 0.3 - 0.5 = Likely bot ⚠️
    // 0.0 - 0.3 = Very likely bot ❌
    
    const MINIMUM_SCORE = 0.5; // ⚙️ ADJUST THIS THRESHOLD:
    // - 0.3 = More lenient (allow more users, but more spam)
    // - 0.5 = Balanced (recommended for most sites)
    // - 0.7 = Stricter (block more bots, but may block real users)
    
    if (!score || score < MINIMUM_SCORE) {
      console.log(`❌ Low reCAPTCHA score: ${score || 'undefined'} (minimum required: ${MINIMUM_SCORE})`);
      console.log('⚠️ Request blocked due to suspicious activity');
      return res.status(400).json({
        success: false,
        message: 'Suspicious activity detected. Please try again later.',
      });
    }

    // ✅ Optional: Verify action matches what was sent from frontend
    // This ensures the token was generated for the correct form action
    if (action && action !== 'contact_form_submit') {
      console.log(`⚠️ Action mismatch: Expected 'contact_form_submit', got '${action}'`);
      // Uncomment below to enforce strict action verification:
      // return res.status(400).json({
      //   success: false,
      //   message: 'Invalid reCAPTCHA action.',
      // });
    }

    // ✅ Verification successful, proceed to controller
    console.log(`✅ reCAPTCHA v3 verification SUCCESS (Score: ${score})`);
    console.log('─────────────────────────────────────────────────────\n');
    next();

  } catch (error) {
    console.error('❌ reCAPTCHA verification error:', error.message);
    
    // ✅ Handle network errors gracefully
    if (error.code === 'ECONNABORTED') {
      console.error('⏱️ Request timeout - Google reCAPTCHA API not responding');
      return res.status(408).json({
        success: false,
        message: 'reCAPTCHA verification timeout. Please try again.',
      });
    }

    if (error.response) {
      console.error('📡 Response error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('📡 No response received from Google');
    } else {
      console.error('⚠️ Error setting up request:', error.message);
    }

    return res.status(500).json({
      success: false,
      message: 'reCAPTCHA verification error. Please try again later.',
    });
  }
};

module.exports = verifyRecaptcha;