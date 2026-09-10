import PocketBase from 'https://cdn.jsdelivr.net/npm/pocketbase@0.21.0/dist/pocketbase.es.mjs';

const pb = new PocketBase('https://pb.xenreality.com');

// Configuration
const RECAPTCHA_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'; // Test key, replace in production

const NAMED_BRANDS = [
  'Axis Communications', 'Bosch', 'CP PLUS', 'Dahua', 'Hanwha Vision',
  'Hikvision', 'Intelbras', 'PRAMA', 'Sony', 'Uniview Technologies', 'Univision'
];

let currentStep = 1;
const TOTAL_STEPS = 4;
let formData = { cameras: [] };

// Initialize form immediately since module scripts are deferred
initForm();

function initForm() {
  const container = document.getElementById('cameraNvrForm');
  if (!container) return;

  // Add reCAPTCHA script dynamically
  const script = document.createElement('script');
  script.src = 'https://www.google.com/recaptcha/api.js';
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);

  renderFormStructure(container);
  bindEvents();
  prefillAuthData();
  updateStepVisibility();
}

function prefillAuthData() {
  const user = pb.authStore.record;
  if (user) {
    const nameInput = document.getElementById('f_name');
    const emailInput = document.getElementById('f_email');
    if (nameInput && user.name) nameInput.value = user.name;
    if (emailInput && user.email) emailInput.value = user.email;
  }
  const dateInput = document.getElementById('f_visit_date');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
}

function renderFormStructure(container) {
  container.innerHTML = `
    <!-- Progress -->
    <div class="form-progress">
      <div class="form-progress-bar" id="progressBar" style="width: 0%"></div>
      <div class="form-step-indicator active" id="ind-1">1</div>
      <div class="form-step-indicator" id="ind-2">2</div>
      <div class="form-step-indicator" id="ind-3">3</div>
      <div class="form-step-indicator" id="ind-4">4</div>
    </div>

    <form id="submissionForm" novalidate>
      <!-- STEP 1: Basic Info -->
      <div class="form-step active" id="step-1">
        <h2 class="form-step-title">Your Details & Store Info</h2>
        <p class="form-step-desc">A few basic details to get started.</p>

        <div class="form-group">
          <label class="form-label">Name <span class="req">*</span></label>
          <input type="text" class="form-control" id="f_name" required>
          <div class="form-error-msg">Name is required</div>
        </div>

        <div class="form-group">
          <label class="form-label">Company Name <span class="req">*</span></label>
          <input type="text" class="form-control" id="f_company" required>
          <div class="form-error-msg">Company Name is required</div>
        </div>

        <div class="form-group">
          <label class="form-label">Mobile Number <span class="req">*</span></label>
          <input type="tel" class="form-control" id="f_phone" placeholder="+919876543210" required>
          <span class="form-hint">Format: +91 followed by 10 digits</span>
          <div class="form-error-msg">Enter a valid Indian phone number (+91XXXXXXXXXX)</div>
        </div>

        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-control" id="f_email">
          <div class="form-error-msg">Enter a valid email</div>
        </div>

        <div class="form-group">
          <label class="form-label">Store Name <span class="req">*</span></label>
          <input type="text" class="form-control" id="f_store_name" required>
          <div class="form-error-msg">Store Name is required</div>
        </div>

        <div class="form-group">
          <label class="form-label">Store Location <span class="req">*</span></label>
          <input type="text" class="form-control" id="f_store_location" required>
          <div class="form-error-msg">Store Location is required</div>
        </div>

        <div class="form-group">
          <label class="form-label">City <span class="req">*</span></label>
          <input type="text" class="form-control" id="f_city" required>
          <div class="form-error-msg">City is required</div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Country <span class="req">*</span></label>
          <input type="text" class="form-control" id="f_country" value="India" required>
          <div class="form-error-msg">Country is required</div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Visit Date <span class="req">*</span></label>
          <input type="date" class="form-control" id="f_visit_date" required>
          <div class="form-error-msg">Visit Date is required</div>
        </div>

        <div class="form-group">
          <label class="form-label">Does this store have an NVR? <span class="req">*</span></label>
          <select class="form-control" id="f_has_nvr" required>
            <option value="">Select...</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
          <div class="form-error-msg">Please select an option</div>
        </div>
      </div>

      <!-- STEP 2: NVR & Camera Details (Dynamic) -->
      <div class="form-step" id="step-2">
        <h2 class="form-step-title" id="step2-title">Camera Brand & Details</h2>
        <p class="form-step-desc" id="step2-desc">Tell us the brand of your camera or NVR.</p>

        <div class="form-group">
          <label class="form-label">What is the camera brand? <span class="req">*</span></label>
          <select class="form-control" id="f_brand" required>
            <option value="">Select...</option>
            ${NAMED_BRANDS.map(b => \`<option value="\${b}">\${b}</option>\`).join('')}
            <option value="Other">Other</option>
          </select>
          <div class="form-error-msg">Brand is required</div>
        </div>

        <div class="form-group hidden" id="fg_brand_other">
          <label class="form-label">If "Other", please type the camera brand name <span class="req">*</span></label>
          <input type="text" class="form-control" id="f_brand_other">
          <div class="form-error-msg">Brand name is required</div>
        </div>

        <!-- Dynamic NVR details block -->
        <div id="nvr-details-container" class="hidden" style="margin-top: 30px; border-top: 1px dashed var(--line); padding-top: 20px;">
          <h3 style="margin-bottom: 15px; color: var(--accent-deep);">NVR Details</h3>
          
          <div class="form-group hidden" id="fg_nvr_cloud_id">
            <label class="form-label">Cloud ID / Serial Number <span class="req">*</span></label>
            <input type="text" class="form-control" id="f_nvr_cloud_id">
            <div class="form-error-msg">Cloud ID is required</div>
          </div>
          
          <div class="form-group hidden" id="fg_nvr_ip">
            <label class="form-label">NVR IP Address <span class="req">*</span></label>
            <input type="text" class="form-control" id="f_nvr_ip" placeholder="e.g. 192.168.1.100">
            <span class="form-hint">Important: this must be a static IP address</span>
            <div class="form-error-msg">Enter a valid IPv4 address</div>
          </div>

          <div class="form-group hidden" id="fg_nvr_port">
            <label class="form-label">Port <span class="req">*</span></label>
            <input type="number" class="form-control" id="f_nvr_port" placeholder="e.g. 8000">
            <div class="form-error-msg">Enter a valid port</div>
          </div>

          <div class="form-group" id="fg_nvr_user">
            <label class="form-label">NVR Username <span class="req">*</span></label>
            <input type="text" class="form-control" id="f_nvr_user">
            <div class="form-error-msg">Username is required</div>
          </div>

          <div class="form-group" id="fg_nvr_pass">
            <label class="form-label">NVR Password <span class="req">*</span></label>
            <div class="pwd-wrap">
              <input type="password" class="form-control" id="f_nvr_pass" autocomplete="off">
              <button type="button" class="pwd-toggle" tabindex="-1">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              </button>
            </div>
            <div class="form-error-msg">Password is required</div>
          </div>
        </div>

        <div class="form-group" style="margin-top: 30px;">
          <label class="form-label">Total number of cameras <span class="req">*</span></label>
          <input type="number" class="form-control" id="f_camera_count" min="1" max="64" required>
          <div class="form-error-msg">Enter a valid number (1-64)</div>
        </div>

        <div id="dynamic-cameras-container"></div>
      </div>

      <!-- STEP 3: Router & Additional Info -->
      <div class="form-step" id="step-3">
        <h2 class="form-step-title">Router & Additional Info</h2>
        <p class="form-step-desc">This last part is optional — only needed if we require router access.</p>

        <div class="form-group">
          <label class="form-label">Do we need router login details for this setup? <span class="req">*</span></label>
          <select class="form-control" id="f_router_needed" required>
            <option value="">Select...</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
          <div class="form-error-msg">Please select an option</div>
        </div>

        <div id="router-details" class="hidden" style="margin-top: 20px; border-top: 1px dashed var(--line); padding-top: 20px;">
          <h3 style="margin-bottom: 15px; color: var(--accent-deep);">Router Login Details</h3>
          
          <div class="form-group">
            <label class="form-label">Router IP <span class="req">*</span></label>
            <input type="text" class="form-control" id="f_router_ip">
            <div class="form-error-msg">Enter a valid IPv4 address</div>
          </div>
          
          <div class="form-group">
            <label class="form-label">Router Username <span class="req">*</span></label>
            <input type="text" class="form-control" id="f_router_user">
            <div class="form-error-msg">Username is required</div>
          </div>
          
          <div class="form-group">
            <label class="form-label">Router Password <span class="req">*</span></label>
            <div class="pwd-wrap">
              <input type="password" class="form-control" id="f_router_pass" autocomplete="off">
              <button type="button" class="pwd-toggle" tabindex="-1">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              </button>
            </div>
            <div class="form-error-msg">Password is required</div>
          </div>
        </div>

        <div class="form-group" style="margin-top: 30px;">
          <label class="form-label">Any other comments</label>
          <textarea class="form-control" id="f_comments" rows="3"></textarea>
        </div>
      </div>

      <!-- STEP 4: Review -->
      <div class="form-step" id="step-4">
        <h2 class="form-step-title">Review & Submit</h2>
        <p class="form-step-desc">Please verify your details before submitting.</p>

        <div id="review-container"></div>

        <div class="form-group" style="margin-top: 20px;">
          <label class="radio-card" style="align-items: flex-start;">
            <input type="checkbox" id="f_confirm" required>
            <span style="line-height: 1.4;">I confirm that the information provided above is accurate and that the cameras/NVR are ready for the technical team to proceed with setup.</span>
          </label>
          <div class="form-error-msg">You must confirm to proceed</div>
        </div>

        <div class="captcha-container">
          <div class="g-recaptcha" data-sitekey="${RECAPTCHA_SITE_KEY}"></div>
          <div class="form-error-msg" id="captcha-error" style="text-align: center;">Please complete the CAPTCHA</div>
        </div>
      </div>

      <!-- Navigation Actions -->
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" id="btn-prev" style="visibility: hidden;">← Back</button>
        <button type="button" class="btn btn-primary" id="btn-next">Next →</button>
        <button type="submit" class="btn btn-success hidden" id="btn-submit">Submit Details</button>
      </div>
    </form>

    <!-- Overlay -->
    <div class="form-overlay" id="form-overlay">
      <div class="spinner"></div>
      <h3 style="margin-bottom: 8px;">Submitting details...</h3>
      <p class="muted">Please wait while we save your response to XenReality records.</p>
    </div>
    
    <!-- Success Overlay -->
    <div class="form-overlay hidden" id="success-overlay" style="background: #fff;">
      <div style="width: 64px; height: 64px; border-radius: 50%; background: #e8f8ec; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
      <h2 style="margin-bottom: 12px; color: var(--ink);">Details Saved Successfully!</h2>
      <p style="color: var(--ink-soft); margin-bottom: 30px; font-size: 1.1rem; line-height: 1.5;">Thank you. The camera and NVR credentials have been securely recorded.</p>
      <button class="btn btn-primary btn-lg" onclick="appFlow.next()">Next: Raspberry Pi Setup →</button>
    </div>
  `;
}

function bindEvents() {
  document.getElementById('btn-prev').addEventListener('click', prevStep);
  document.getElementById('btn-next').addEventListener('click', nextStep);
  document.getElementById('submissionForm').addEventListener('submit', handleSubmit);
  
  // Field toggles
  document.getElementById('f_has_nvr').addEventListener('change', updateDynamicFields);
  document.getElementById('f_brand').addEventListener('change', updateDynamicFields);
  document.getElementById('f_router_needed').addEventListener('change', updateDynamicFields);
  
  // Camera count generation
  document.getElementById('f_camera_count').addEventListener('change', generateCameraFields);
  document.getElementById('f_camera_count').addEventListener('input', generateCameraFields);

  // Validation removal on input
  document.querySelectorAll('.form-control').forEach(el => {
    el.addEventListener('input', () => {
      el.classList.remove('error');
      const msg = el.nextElementSibling;
      if (msg && msg.classList.contains('form-error-msg')) {
        msg.classList.remove('visible');
      }
    });
  });

  // Password toggles
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('.pwd-toggle');
    if (btn) {
      const input = btn.previousElementSibling;
      if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
      } else {
        input.type = 'password';
        btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
      }
    }
    
    const copyBtn = e.target.closest('.copy-btn');
    if (copyBtn) {
      copyCredentialsFromFirstCamera();
    }
  });
}

function updateDynamicFields() {
  const hasNvr = document.getElementById('f_has_nvr').value;
  const brand = document.getElementById('f_brand').value;
  const isOther = brand === 'Other';
  const routerNeeded = document.getElementById('f_router_needed').value === 'Yes';
  
  // Brand "Other" text input
  document.getElementById('fg_brand_other').classList.toggle('hidden', !isOther);
  if (isOther) document.getElementById('f_brand_other').required = true;
  else {
    document.getElementById('f_brand_other').required = false;
    document.getElementById('f_brand_other').value = '';
  }

  // NVR Fields
  const nvrContainer = document.getElementById('nvr-details-container');
  if (hasNvr === 'Yes' && brand) {
    nvrContainer.classList.remove('hidden');
    
    const isCpPlus = brand === 'CP PLUS';
    const isHikvision = brand === 'Hikvision';
    
    // Cloud ID (only CP Plus)
    document.getElementById('fg_nvr_cloud_id').classList.toggle('hidden', !isCpPlus);
    document.getElementById('f_nvr_cloud_id').required = isCpPlus;
    
    // NVR IP (Hikvision, Other named, Other typed)
    const needIp = !isCpPlus;
    document.getElementById('fg_nvr_ip').classList.toggle('hidden', !needIp);
    document.getElementById('f_nvr_ip').required = needIp;
    
    // NVR Port (Hikvision)
    document.getElementById('fg_nvr_port').classList.toggle('hidden', !isHikvision);
    document.getElementById('f_nvr_port').required = isHikvision;
    
    // NVR User/Pass required for all NVR setups
    document.getElementById('f_nvr_user').required = true;
    document.getElementById('f_nvr_pass').required = true;
    
  } else {
    nvrContainer.classList.add('hidden');
    document.getElementById('f_nvr_cloud_id').required = false;
    document.getElementById('f_nvr_ip').required = false;
    document.getElementById('f_nvr_port').required = false;
    document.getElementById('f_nvr_user').required = false;
    document.getElementById('f_nvr_pass').required = false;
  }

  // Router Fields
  document.getElementById('router-details').classList.toggle('hidden', !routerNeeded);
  document.getElementById('f_router_ip').required = routerNeeded;
  document.getElementById('f_router_user').required = routerNeeded;
  document.getElementById('f_router_pass').required = routerNeeded;
  
  // Update camera fields if count is already entered
  generateCameraFields();
}

function generateCameraFields() {
  const container = document.getElementById('dynamic-cameras-container');
  const count = parseInt(document.getElementById('f_camera_count').value) || 0;
  const hasNvr = document.getElementById('f_has_nvr').value;
  
  if (count <= 0 || count > 64) {
    container.innerHTML = '';
    return;
  }
  
  // Determine what fields a camera needs based on NVR status
  const needCreds = hasNvr === 'No'; // If no NVR, each camera needs user/pass
  
  let html = '<h3 style="margin: 30px 0 15px; color: var(--accent-deep);">Camera Details</h3>';
  if (needCreds && count > 1) {
    html += \`
      <div style="margin-bottom: 15px; text-align: right;">
        <button type="button" class="copy-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          Copy credentials from Camera 1 to all
        </button>
      </div>
    \`;
  }
  
  for (let i = 1; i <= count; i++) {
    html += \`
      <div class="camera-card" style="margin-bottom: 20px;">
        <div class="camera-card-head">Camera \${i}</div>
        <div class="camera-card-body">
          <div class="form-group">
            <label class="form-label">IP Address <span class="req">*</span></label>
            <input type="text" class="form-control cam-ip" data-idx="\${i}" required placeholder="e.g. 192.168.1.10\${i}">
          </div>
          <div class="form-group">
            <label class="form-label">Channel Number</label>
            <input type="text" class="form-control cam-chan" data-idx="\${i}">
          </div>
    \`;
    
    if (needCreds) {
      html += \`
          <div class="form-group">
            <label class="form-label">Username <span class="req">*</span></label>
            <input type="text" class="form-control cam-user" data-idx="\${i}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Password <span class="req">*</span></label>
            <div class="pwd-wrap">
              <input type="password" class="form-control cam-pass" data-idx="\${i}" required autocomplete="off">
              <button type="button" class="pwd-toggle" tabindex="-1">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              </button>
            </div>
          </div>
      \`;
    }
    
    html += \`
        </div>
      </div>
    \`;
  }
  
  // Preserve existing values if re-generating
  const existingIps = Array.from(document.querySelectorAll('.cam-ip')).map(el => el.value);
  const existingChans = Array.from(document.querySelectorAll('.cam-chan')).map(el => el.value);
  const existingUsers = Array.from(document.querySelectorAll('.cam-user')).map(el => el.value);
  const existingPass = Array.from(document.querySelectorAll('.cam-pass')).map(el => el.value);
  
  container.innerHTML = html;
  
  // Restore values
  document.querySelectorAll('.cam-ip').forEach((el, idx) => { if (existingIps[idx]) el.value = existingIps[idx]; });
  document.querySelectorAll('.cam-chan').forEach((el, idx) => { if (existingChans[idx]) el.value = existingChans[idx]; });
  document.querySelectorAll('.cam-user').forEach((el, idx) => { if (existingUsers[idx]) el.value = existingUsers[idx]; });
  document.querySelectorAll('.cam-pass').forEach((el, idx) => { if (existingPass[idx]) el.value = existingPass[idx]; });
}

function copyCredentialsFromFirstCamera() {
  const user1 = document.querySelector('.cam-user[data-idx="1"]')?.value || '';
  const pass1 = document.querySelector('.cam-pass[data-idx="1"]')?.value || '';
  
  if (!user1 && !pass1) {
    alert('Please enter credentials for Camera 1 first.');
    return;
  }
  
  document.querySelectorAll('.cam-user').forEach((el, idx) => {
    if (idx > 0) el.value = user1;
  });
  document.querySelectorAll('.cam-pass').forEach((el, idx) => {
    if (idx > 0) el.value = pass1;
  });
}

function validateStep(step) {
  let isValid = true;
  const currentStepEl = document.getElementById(\`step-\${step}\`);
  const requiredInputs = currentStepEl.querySelectorAll('input[required], select[required]');
  
  // Basic required check
  requiredInputs.forEach(input => {
    // Skip if hidden
    if (input.closest('.hidden')) return;
    
    let error = false;
    let customMsg = '';
    
    if (!input.value.trim()) {
      if (input.type === 'checkbox') {
        error = !input.checked;
      } else {
        error = true;
      }
    } else {
      // Format validation
      if (input.id === 'f_phone' && !/^\\+91\\d{10}$/.test(input.value.trim())) {
        error = true;
      }
      if (input.type === 'email' && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(input.value.trim())) {
        error = true;
      }
      if (input.id === 'f_nvr_ip' || input.id === 'f_router_ip' || input.classList.contains('cam-ip')) {
        if (!/^((25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(25[0-5]|2[0-4]\\d|[01]?\\d\\d?)$/.test(input.value.trim())) {
          error = true;
          customMsg = 'Enter a valid IPv4 address';
        }
      }
    }
    
    if (error) {
      isValid = false;
      input.classList.add('error');
      const msg = input.nextElementSibling;
      if (msg && msg.classList.contains('form-error-msg')) {
        if (customMsg) msg.textContent = customMsg;
        msg.classList.add('visible');
      } else if (input.parentElement.nextElementSibling && input.parentElement.nextElementSibling.classList.contains('form-error-msg')) {
        input.parentElement.nextElementSibling.classList.add('visible');
      }
    }
  });
  
  if (!isValid) {
    // Scroll to first error
    const firstError = currentStepEl.querySelector('.error');
    if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  
  return isValid;
}

function generateReviewHtml() {
  const v = (id) => document.getElementById(id)?.value || '-';
  const hasNvr = v('f_has_nvr') === 'Yes';
  
  let html = '<div class="summary-box">';
  html += \`
    <div class="summary-row"><span class="summary-label">Store</span><span class="summary-val">\${v('f_store_name')} (\${v('f_store_location')}, \${v('f_city')})</span></div>
    <div class="summary-row"><span class="summary-label">Contact</span><span class="summary-val">\${v('f_name')} | \${v('f_phone')}</span></div>
    <div class="summary-row"><span class="summary-label">NVR Present</span><span class="summary-val">\${v('f_has_nvr')}</span></div>
    <div class="summary-row"><span class="summary-label">Camera Brand</span><span class="summary-val">\${v('f_brand') === 'Other' ? v('f_brand_other') : v('f_brand')}</span></div>
  \`;
  
  if (hasNvr) {
    const b = v('f_brand');
    if (b === 'CP PLUS') {
      html += \`<div class="summary-row"><span class="summary-label">NVR Cloud ID</span><span class="summary-val">\${v('f_nvr_cloud_id')}</span></div>\`;
    } else {
      html += \`<div class="summary-row"><span class="summary-label">NVR IP</span><span class="summary-val">\${v('f_nvr_ip')}</span></div>\`;
      if (b === 'Hikvision') {
        html += \`<div class="summary-row"><span class="summary-label">NVR Port</span><span class="summary-val">\${v('f_nvr_port')}</span></div>\`;
      }
    }
    html += \`<div class="summary-row"><span class="summary-label">NVR Username</span><span class="summary-val">\${v('f_nvr_user')}</span></div>\`;
  }
  
  html += \`<div class="summary-row"><span class="summary-label">Total Cameras</span><span class="summary-val">\${v('f_camera_count')}</span></div>\`;
  html += '</div>';
  
  if (v('f_router_needed') === 'Yes') {
    html += '<div class="summary-box">';
    html += \`<div class="summary-row"><span class="summary-label">Router IP</span><span class="summary-val">\${v('f_router_ip')}</span></div>\`;
    html += \`<div class="summary-row"><span class="summary-label">Router User</span><span class="summary-val">\${v('f_router_user')}</span></div>\`;
    html += '</div>';
  }
  
  document.getElementById('review-container').innerHTML = html;
}

function nextStep() {
  if (!validateStep(currentStep)) return;
  
  if (currentStep === 3) {
    generateReviewHtml();
  }
  
  currentStep++;
  updateStepVisibility();
}

function prevStep() {
  currentStep--;
  updateStepVisibility();
}

function updateStepVisibility() {
  // Hide all
  document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.form-step-indicator').forEach(i => {
    i.classList.remove('active');
    i.classList.remove('completed');
  });
  
  // Show current
  document.getElementById(\`step-\${currentStep}\`).classList.add('active');
  
  // Update progress
  const progressPercent = ((currentStep - 1) / (TOTAL_STEPS - 1)) * 100;
  document.getElementById('progressBar').style.width = \`\${progressPercent}%\`;
  
  // Update indicators
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const ind = document.getElementById(\`ind-\${i}\`);
    if (i < currentStep) ind.classList.add('completed');
    else if (i === currentStep) ind.classList.add('active');
  }
  
  // Update buttons
  document.getElementById('btn-prev').style.visibility = currentStep === 1 ? 'hidden' : 'visible';
  if (currentStep === TOTAL_STEPS) {
    document.getElementById('btn-next').classList.add('hidden');
    document.getElementById('btn-submit').classList.remove('hidden');
  } else {
    document.getElementById('btn-next').classList.remove('hidden');
    document.getElementById('btn-submit').classList.add('hidden');
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  
  if (!validateStep(4)) return;
  
  // Validate CAPTCHA
  const captchaResponse = window.grecaptcha ? grecaptcha.getResponse() : '';
  if (!captchaResponse) {
    document.getElementById('captcha-error').classList.add('visible');
    return;
  }
  document.getElementById('captcha-error').classList.remove('visible');
  
  const v = (id) => document.getElementById(id)?.value || '';
  const brandValue = v('f_brand') === 'Other' ? v('f_brand_other') : v('f_brand');
  
  // Collect main payload
  const payload = {
    store_name: v('f_store_name'),
    store_location: v('f_store_location'),
    city: v('f_city'),
    country: v('f_country'),
    field_engineer_name: v('f_name'),
    field_engineer_company: v('f_company'),
    field_engineer_phone: v('f_phone'),
    field_engineer_email: v('f_email'),
    visit_date: v('f_visit_date'),
    has_nvr: v('f_has_nvr') === 'Yes',
    camera_brand: brandValue,
    camera_count: parseInt(v('f_camera_count')) || 0,
    router_ip: v('f_router_ip'),
    router_username: v('f_router_user'),
    router_password: v('f_router_pass'),
    additional_notes: v('f_comments'),
    status: 'pending',
    submitted_by: pb.authStore.record?.id
  };
  
  if (payload.has_nvr) {
    payload.nvr_cloud_id = v('f_nvr_cloud_id');
    payload.nvr_ip_address = v('f_nvr_ip');
    payload.nvr_port = parseInt(v('f_nvr_port')) || null;
    payload.nvr_username = v('f_nvr_user');
    payload.nvr_password = v('f_nvr_pass');
  }
  
  // Collect camera details
  const cameras = [];
  const count = payload.camera_count;
  for (let i = 1; i <= count; i++) {
    const cam = {
      camera_number: i,
      camera_ip_address: document.querySelector(\`.cam-ip[data-idx="\${i}"]\`)?.value || '',
      camera_channel: document.querySelector(\`.cam-chan[data-idx="\${i}"]\`)?.value || ''
    };
    if (!payload.has_nvr) {
      cam.camera_username = document.querySelector(\`.cam-user[data-idx="\${i}"]\`)?.value || '';
      cam.camera_password = document.querySelector(\`.cam-pass[data-idx="\${i}"]\`)?.value || '';
    }
    cameras.push(cam);
  }
  
  try {
    document.getElementById('form-overlay').classList.add('active');
    
    // Create main record
    const submissionRecord = await pb.collection('camera_nvr_submissions').create(payload);
    
    // Create camera records in parallel
    const camPromises = cameras.map(cam => {
      cam.submission = submissionRecord.id;
      return pb.collection('camera_details').create(cam);
    });
    
    await Promise.all(camPromises);
    
    // Success
    document.getElementById('form-overlay').classList.remove('active');
    document.getElementById('success-overlay').classList.remove('hidden');
    document.getElementById('submissionForm').reset();
    if (window.grecaptcha) window.grecaptcha.reset();
    
  } catch (err) {
    console.error("Submission error:", err);
    document.getElementById('form-overlay').classList.remove('active');
    alert("An error occurred while submitting. Please try again. " + (err.message || ''));
  }
}
