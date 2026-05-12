// ==================== GLOBAL VARIABLES ====================
var selectedTemplate = null;
var templateFileCount = 0;
var currentFolderType = 'main';
var isEditMode = false;
var previewData = null;
var lockedFields = {};
var monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
var aliasCounters = { 'major': 0, 'minor': 0, 'religion': 0 };
var phoneStats = { total: 0, used: 0, available: 0 };

// Track phones in current form (local only - NOT session)
var currentFormPhones = {};

// Field Labels
var fieldLabels = {
    'OLD_NAME': 'Old Name',
    'NEW_NAME': 'New Name',
    'UPDATE_RELATION': 'Relation',
    'FATHER-SPOUSE_NAME': 'Father/Spouse',
    'SPOUSE_NAME1': 'Husband Name',
    'GENDER_UPDATE': 'Gender',
    'CAST_UPDATE': 'Religion/Cast',
    'UPDATE_ADDRESS': 'Address',
    'PHONE_UPDATE': 'Phone',
    'EMAIL_UPDATE': 'Email',
    'NUM_DATE': 'Date of Submission',
    'ALPHA_DATE': 'Date (Alpha)',
    'WITNESS_NAME1': 'Witness 1',
    'WITNESS_ADDRESS1': 'W1 Address',
    'WITNESS_PHONE1': 'W1 Phone',
    'WITNESS_NAME2': 'Witness 2',
    'WITNESS_ADDRESS2': 'W2 Address',
    'WITNESS_PHONE2': 'W2 Phone',
    'FATHER-MOTHER_NAME': 'Father/Mother',
    'SON-DAUGHTER': 'Son/Daughter',
    'UPDATE_AGE': 'Age',
    'CHILD_DOB': 'DOB',
    'BIRTH_PLACE': 'Birth Place'
};

var previewFieldOrder = [
    'OLD_NAME', 'NEW_NAME', 'UPDATE_RELATION', 'FATHER-SPOUSE_NAME', 'SPOUSE_NAME1',
    'GENDER_UPDATE', 'PHONE_UPDATE', 'EMAIL_UPDATE', 'CAST_UPDATE', 'UPDATE_ADDRESS',
    'NUM_DATE', 'ALPHA_DATE', 'FATHER-MOTHER_NAME', 'SON-DAUGHTER', 'UPDATE_AGE', 'CHILD_DOB', 'BIRTH_PLACE',
    'WITNESS_NAME1', 'WITNESS_PHONE1', 'WITNESS_ADDRESS1', 'WITNESS_NAME2', 'WITNESS_PHONE2', 'WITNESS_ADDRESS2'
];

var hiddenPreviewFields = ['HE_SHE', 'WIFE_OF', 'FATHER_NAME'];

// ==================== UTILITY FUNCTIONS ====================
function escapeHtml(t) {
    var d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
}

function padDay(d) {
    var n = parseInt(d);
    if (isNaN(n) || n < 1) return '';
    return n < 10 ? '0' + n : n.toString();
}

function getOrdinalSuffix(d) {
    var n = parseInt(d);
    if (n >= 11 && n <= 13) return 'TH';
    switch (n % 10) {
        case 1: return 'ST';
        case 2: return 'ND';
        case 3: return 'RD';
        default: return 'TH';
    }
}

function scrollToElement(el) {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('field-error');
    el.focus();
    setTimeout(function () {
        el.classList.remove('field-error');
    }, 1000);
}

function updateTime() {
    var n = new Date();
    var el = document.getElementById('current-time');
    if (el) {
        el.textContent = n.toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }
}

// ==================== PHONE NUMBER MANAGEMENT (SIMPLE) ====================

function loadPhoneStats() {
    fetch('/api/phone/stats')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.success) {
                phoneStats = data.stats;
            }
        })
        .catch(function (e) {
            console.error('Error loading phone stats:', e);
        });
}

function getExcludePhones(excludeInputId) {
    /**
     * Get list of phones currently in form inputs to exclude
     * This ensures each phone field gets a DIFFERENT number
     */
    var excludeList = [];

    // Get phones from all phone inputs except the one being filled
    document.querySelectorAll('.phone-input').forEach(function (inp) {
        if (inp.id !== excludeInputId) {
            var val = inp.value.trim();
            if (val && val.length === 10) {
                excludeList.push(val);
            }
        }
    });

    // Also add from tracking object
    Object.keys(currentFormPhones).forEach(function (key) {
        if (key !== excludeInputId && currentFormPhones[key]) {
            if (excludeList.indexOf(currentFormPhones[key]) === -1) {
                excludeList.push(currentFormPhones[key]);
            }
        }
    });

    return excludeList;
}

function getNextPhone(inputId) {
    var phoneInput = document.getElementById(inputId);
    var indicator = document.getElementById(inputId + '_indicator');
    var btn = phoneInput ? phoneInput.closest('.input-group').querySelector('.btn-get-phone') : null;

    if (!phoneInput) return;

    // Show loading
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    }

    // Build exclude list (other phones in this form)
    var excludePhones = getExcludePhones(inputId);

    console.log('Getting phone for:', inputId, 'Excluding:', excludePhones);

    fetch('/api/phone/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exclude: excludePhones })
    })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.success && data.phone) {
                phoneInput.value = data.phone;
                phoneInput.dataset.autoFilled = 'true';
                phoneInput.classList.remove('is-invalid');
                phoneInput.classList.add('is-valid');

                // Track this phone
                currentFormPhones[inputId] = data.phone;

                // Show indicator
                if (indicator) {
                    indicator.classList.remove('d-none');
                    indicator.innerHTML = '<i class="bi bi-magic"></i> Auto-filled';
                    indicator.classList.remove('modified');
                }

                // Update stats
                if (data.stats) phoneStats = data.stats;

                // Update digit counter
                var pc = phoneInput.closest('.phone-auto-container');
                var ct = pc ? pc.querySelector('.digit-counter') : null;
                if (ct) {
                    ct.textContent = '10/10 digits';
                    ct.classList.remove('warning', 'error');
                    ct.classList.add('success');
                }

                // Flash effect
                phoneInput.classList.add('auto-filled');
                setTimeout(function () {
                    phoneInput.classList.remove('auto-filled');
                }, 1500);

                console.log('✅ Phone assigned:', data.phone);
            } else {
                showToast('warning', 'Phone', data.message || 'No phone numbers available');
            }
        })
        .catch(function (e) {
            console.error('Error getting phone:', e);
            showToast('error', 'Error', 'Failed to get phone number');
        })
        .finally(function () {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-arrow-repeat"></i>';
            }
        });
}

function autoFillAllPhones() {
    // Clear tracking
    currentFormPhones = {};

    // Determine template prefix
    var prefix = 'major';
    if (selectedTemplate === 'minor_template') prefix = 'minor';
    else if (selectedTemplate === 'religion_template') prefix = 'religion';

    var mainPhoneId = prefix + '_phone_update';
    var phoneSequence = [mainPhoneId, 'witness_phone1', 'witness_phone2'];
    var currentIndex = 0;

    function fillNextPhone() {
        if (currentIndex >= phoneSequence.length) {
            console.log('✅ All phones filled:', currentFormPhones);
            return;
        }

        var phoneId = phoneSequence[currentIndex];
        var phoneInput = document.getElementById(phoneId);

        // Only fill if empty
        if (phoneInput && !phoneInput.value.trim()) {
            getNextPhone(phoneId);
        }

        currentIndex++;

        // Fill next after delay
        if (currentIndex < phoneSequence.length) {
            setTimeout(fillNextPhone, 400);
        }
    }

    // Start filling
    setTimeout(fillNextPhone, 100);
}

function clearAllPhoneInputs() {
    currentFormPhones = {};

    document.querySelectorAll('.phone-input').forEach(function (inp) {
        inp.value = '';
        inp.dataset.autoFilled = '';
        inp.classList.remove('is-valid', 'is-invalid');
    });

    document.querySelectorAll('.phone-auto-indicator').forEach(function (ind) {
        ind.classList.add('d-none');
    });

    document.querySelectorAll('.digit-counter').forEach(function (ct) {
        ct.textContent = '0/10 digits';
        ct.classList.remove('success', 'warning', 'error');
    });
}

function setupPhoneValidation() {
    document.querySelectorAll('.phone-input').forEach(function (inp) {
        var pc = inp.closest('.phone-auto-container') || inp.closest('.col-md-4');
        var ct = pc ? pc.querySelector('.digit-counter') : null;

        // Allow editing
        inp.removeAttribute('readonly');
        inp.removeAttribute('disabled');

        // Only allow digits
        inp.addEventListener('keypress', function (e) {
            if (!/[0-9]/.test(e.key)) {
                e.preventDefault();
                return false;
            }
            if (this.value.length >= 10) {
                e.preventDefault();
                return false;
            }
        });

        // Handle paste
        inp.addEventListener('paste', function (e) {
            e.preventDefault();
            var pastedText = (e.clipboardData || window.clipboardData).getData('text');
            var cleanedText = pastedText.replace(/\D/g, '').slice(0, 10);
            this.value = cleanedText;
            updatePhoneCounter(this, ct);

            if (cleanedText.length === 10) {
                currentFormPhones[this.id] = cleanedText;
            }
        });

        // Handle input
        inp.addEventListener('input', function () {
            var v = this.value.replace(/\D/g, '').slice(0, 10);
            if (this.value !== v) {
                this.value = v;
            }
            updatePhoneCounter(this, ct);

            // Update tracking
            if (v.length === 10) {
                currentFormPhones[this.id] = v;
            } else {
                delete currentFormPhones[this.id];
            }

            // Show modified indicator
            var indicator = document.getElementById(this.id + '_indicator');
            if (this.dataset.autoFilled === 'true' && indicator) {
                indicator.innerHTML = '<i class="bi bi-pencil"></i> Modified';
                indicator.classList.add('modified');
                indicator.classList.remove('d-none');
            }
        });

        // Validate on blur
        inp.addEventListener('blur', function () {
            validatePhoneNumber(this, ct);
        });
    });
}

function updatePhoneCounter(inp, ct) {
    if (!ct) return;
    var l = inp.value.length;
    ct.textContent = l + '/10 digits';
    ct.classList.remove('warning', 'error', 'success');

    if (l === 0) {
        // Default
    } else if (l < 10) {
        ct.classList.add('warning');
    } else {
        ct.classList.add('success');
    }

    if (l === 10) {
        inp.classList.remove('is-invalid');
        inp.classList.add('is-valid');
    } else if (l > 0) {
        inp.classList.remove('is-valid');
    } else {
        inp.classList.remove('is-valid', 'is-invalid');
    }
}

function validatePhoneNumber(inp, ct) {
    var l = inp.value.length;
    if (l === 0) {
        inp.classList.remove('is-invalid', 'is-valid');
        if (ct) ct.classList.remove('error', 'warning', 'success');
        return true;
    } else if (l === 10) {
        inp.classList.remove('is-invalid');
        inp.classList.add('is-valid');
        if (ct) {
            ct.classList.remove('error', 'warning');
            ct.classList.add('success');
        }
        return true;
    } else {
        inp.classList.remove('is-valid');
        inp.classList.add('is-invalid');
        if (ct) {
            ct.classList.remove('warning', 'success');
            ct.classList.add('error');
        }
        return false;
    }
}

// ==================== AGE CALCULATION ====================
function calculateAgeFromDOB() {
    var dobInput = document.getElementById('minor_child_dob');
    var ageInput = document.getElementById('minor_update_age');
    var indicator = document.getElementById('minor_age_indicator');
    var errorMsg = document.getElementById('dob_error_message');

    if (!dobInput || !ageInput) return;

    ageInput.classList.remove('is-invalid', 'is-valid');
    dobInput.classList.remove('is-invalid', 'is-valid');
    if (errorMsg) errorMsg.classList.add('d-none');

    if (!dobInput.value) {
        ageInput.value = '';
        ageInput.placeholder = 'Auto-calculated';
        if (indicator) indicator.classList.add('d-none');
        return;
    }

    var dob = new Date(dobInput.value);
    var today = new Date();

    if (dob > today) {
        showToast('error', 'Invalid DOB', 'Date of birth cannot be in the future!');
        ageInput.value = '';
        ageInput.classList.add('is-invalid');
        dobInput.classList.add('is-invalid');
        return;
    }

    var age = today.getFullYear() - dob.getFullYear();
    var monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    age = Math.max(0, Math.floor(age));

    if (age >= 18) {
        showToast('error', 'Not a Minor!', 'Person is ' + age + ' years old. Use MAJOR template.');
        ageInput.value = '';
        ageInput.classList.add('is-invalid');
        dobInput.classList.add('is-invalid');

        if (errorMsg) {
            errorMsg.classList.remove('d-none');
            errorMsg.innerHTML = '<i class="bi bi-exclamation-circle me-1"></i>Person is ' + age + ' (18+). Use Major Template!';
        }
        return;
    }

    ageInput.value = age;
    ageInput.classList.add('is-valid');
    dobInput.classList.add('is-valid');

    if (indicator) {
        indicator.classList.remove('d-none');
        indicator.innerHTML = '<i class="bi bi-check-circle-fill text-success"></i> Age: ' + age + ' years';
    }
}

function setupDOBAutoAge() {
    var dobField = document.getElementById('minor_child_dob');
    if (dobField) {
        dobField.addEventListener('change', calculateAgeFromDOB);
        var today = new Date().toISOString().split('T')[0];
        dobField.setAttribute('max', today);
    }
}

// ==================== EMAIL GENERATION ====================
function generateEmailFromName(p) {
    var n, e, i;
    if (p === 'major') {
        n = document.getElementById('major_old_name');
        e = document.getElementById('major_email_update');
        i = document.getElementById('major_email_indicator');
    } else if (p === 'minor') {
        n = document.getElementById('minor_fathermother_name');
        e = document.getElementById('minor_email_update');
        i = document.getElementById('minor_email_indicator');
    } else if (p === 'religion') {
        n = document.getElementById('religion_old_name');
        e = document.getElementById('religion_email_update');
        i = document.getElementById('religion_email_indicator');
    }

    if (!n || !e) return;

    var name = n.value.trim();
    if (!name) {
        e.value = '';
        if (i) i.classList.add('d-none');
        return;
    }

    if (e.dataset.autoGenerated !== 'true' && e.value.trim()) return;

    var clean = name.replace(/[^a-zA-Z]/g, '').toUpperCase();
    if (!clean) return;

    var rnd = Math.floor(Math.random() * 900) + 100;
    e.value = clean + rnd + '@GMAIL.COM';
    e.dataset.autoGenerated = 'true';
    e.classList.add('auto-filled');

    if (i) i.classList.remove('d-none');

    setTimeout(function () {
        e.classList.remove('auto-filled');
    }, 1500);
}

// ==================== ADDRESS COPY ====================
function copyAddressToWitnesses(p) {
    var a = document.getElementById(p + '_update_address');
    var w1 = document.getElementById('witness_address1');
    var w2 = document.getElementById('witness_address2');

    if (!a || !w1 || !w2) return;

    var addr = a.value.trim().toUpperCase();

    if (!w1.value.trim() || w1.dataset.autoFilled === 'true') {
        w1.value = addr;
        w1.dataset.autoFilled = 'true';
    }

    if (!w2.value.trim() || w2.dataset.autoFilled === 'true') {
        w2.value = addr;
        w2.dataset.autoFilled = 'true';
    }
}

// ==================== ALIAS HANDLING ====================
function addAliasField(p) {
    aliasCounters[p]++;
    var c = document.getElementById(p + '_alias_container');
    var n = aliasCounters[p];

    var wrapper = document.createElement('div');
    wrapper.className = 'alias-field-wrapper';
    wrapper.id = p + '_alias_item_' + n;

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-control uppercase-input alias-input';
    input.name = 'alias_names[]';
    input.placeholder = 'Alias ' + n;
    input.setAttribute('oninput', "this.value=this.value.toUpperCase();updateAliasPreview('" + p + "');");

    var deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'remove-alias-btn';
    deleteBtn.title = 'Remove Alias';
    deleteBtn.setAttribute('onclick', "removeAliasField('" + p + "'," + n + ")");
    deleteBtn.innerHTML = '<i class="bi bi-trash3"></i>';

    wrapper.appendChild(input);
    wrapper.appendChild(deleteBtn);
    c.appendChild(wrapper);

    updateAliasCounter(p);
    updateAliasPreview(p);
    input.focus();
}

function removeAliasField(p, n) {
    var d = document.getElementById(p + '_alias_item_' + n);
    if (d) {
        d.remove();
        updateAliasCounter(p);
        updateAliasPreview(p);
    }
}

function updateAliasCounter(p) {
    var c = document.getElementById(p + '_alias_container');
    var ct = document.getElementById(p + '_alias_counter');
    var n = c.querySelectorAll('.alias-field-wrapper').length;
    if (n > 0) {
        ct.style.display = 'block';
        ct.querySelector('.count').textContent = n;
    } else {
        ct.style.display = 'none';
    }
}

function updateAliasPreview(p) {
    var o = document.getElementById(p + '_old_name');
    var c = document.getElementById(p + '_alias_container');
    var pr = document.getElementById(p + '_alias_preview');
    var pt = document.getElementById(p + '_alias_preview_text');

    var name = o ? o.value.trim().toUpperCase() : '';
    var inps = c.querySelectorAll('.alias-input');
    var html = '<span class="name-text">' + (name || 'NAME') + '</span>';
    var has = false;

    inps.forEach(function (i) {
        var v = i.value.trim().toUpperCase();
        if (v) {
            has = true;
            html += ' <span class="alias-keyword">alias</span> <span class="name-text">' + v + '</span>';
        }
    });

    if (name || has) {
        pr.style.display = 'block';
        pt.innerHTML = html;
    } else {
        pr.style.display = 'none';
    }
}

function getAliasNames(p) {
    var c = document.getElementById(p + '_alias_container');
    var inps = c.querySelectorAll('.alias-input');
    var a = [];
    inps.forEach(function (i) {
        var v = i.value.trim().toUpperCase();
        if (v) a.push(v);
    });
    return a;
}

function buildOldNameWithAliases(p) {
    var o = document.getElementById(p + '_old_name');
    var name = o ? o.value.trim().toUpperCase() : '';
    var a = getAliasNames(p);
    if (a.length === 0) return name;
    return name + ' alias ' + a.join(' alias ');
}

function clearAliases(p) {
    var c = document.getElementById(p + '_alias_container');
    c.innerHTML = '';
    aliasCounters[p] = 0;
    updateAliasCounter(p);
    updateAliasPreview(p);
}

// ==================== RELATION HANDLING ====================
function setupRelationAutoGender() {
    var maj = document.getElementById('majorRelationSelect');
    var rel = document.getElementById('religionRelationSelect');
    var min = document.getElementById('minorRelationSelect');

    if (maj) maj.addEventListener('change', function () { handleMajorRelationChange(this.value); });
    if (rel) rel.addEventListener('change', function () { handleReligionRelationChange(this.value); });
    if (min) min.addEventListener('change', function () { handleMinorRelationChange(this.value); });
}

function handleMajorRelationChange(v) {
    var nf = document.getElementById('majorNormalFatherSpouseField');
    var df = document.getElementById('majorDualRelationFields');
    var ni = document.getElementById('major_fatherspouse_name');
    var fi = document.getElementById('major_father_name');
    var si = document.getElementById('major_spouse_name');
    var gs = document.getElementById('majorGenderSelect');
    var ht = document.getElementById('majorRelationHint');

    if (v === 'd/w') {
        nf.classList.add('d-none');
        df.classList.remove('d-none');
        ni.disabled = true;
        ni.value = '';
        ni.removeAttribute('data-required');
        fi.disabled = false;
        si.disabled = false;
        fi.setAttribute('data-required', 'true');
        si.setAttribute('data-required', 'true');
        if (gs) gs.value = 'FEMALE';
        if (ht) ht.classList.add('d-none');
    } else {
        nf.classList.remove('d-none');
        df.classList.add('d-none');
        ni.disabled = false;
        ni.setAttribute('data-required', 'true');
        fi.disabled = true;
        si.disabled = true;
        fi.value = '';
        si.value = '';

        if (v === 's' && gs) gs.value = 'MALE';
        else if ((v === 'd' || v === 'w') && gs) gs.value = 'FEMALE';

        if (v === 'd' && ht) {
            ht.classList.remove('d-none');
        } else if (ht) {
            ht.classList.add('d-none');
        }
    }

    fetchTemplatesByRelation(selectedTemplate, v);
}

function handleReligionRelationChange(v) {
    var nf = document.getElementById('religionNormalFatherSpouseField');
    var df = document.getElementById('religionDualRelationFields');
    var ni = document.getElementById('religion_fatherspouse_name');
    var fi = document.getElementById('religion_father_name');
    var si = document.getElementById('religion_spouse_name');
    var gs = document.getElementById('religionGenderSelect');
    var ht = document.getElementById('religionRelationHint');

    if (v === 'd/w') {
        nf.classList.add('d-none');
        df.classList.remove('d-none');
        ni.disabled = true;
        ni.value = '';
        fi.disabled = false;
        si.disabled = false;
        if (gs) gs.value = 'FEMALE';
        if (ht) ht.classList.add('d-none');
    } else {
        nf.classList.remove('d-none');
        df.classList.add('d-none');
        ni.disabled = false;
        fi.disabled = true;
        si.disabled = true;
        fi.value = '';
        si.value = '';

        if (v === 's' && gs) gs.value = 'MALE';
        else if ((v === 'd' || v === 'w') && gs) gs.value = 'FEMALE';

        if (v === 'd' && ht) ht.classList.remove('d-none');
        else if (ht) ht.classList.add('d-none');
    }

    fetchTemplatesByRelation(selectedTemplate, v);
}

function handleMinorRelationChange(v) {
    var nf = document.getElementById('minorNormalGuardianSpouseField');
    var df = document.getElementById('minorDualRelationFields');
    var ni = document.getElementById('minor_fatherspouse_name');
    var fi = document.getElementById('minor_guardian_father_name');
    var si = document.getElementById('minor_guardian_spouse_name');

    if (v === 'd/w') {
        nf.classList.add('d-none');
        df.classList.remove('d-none');
        ni.disabled = true;
        ni.value = '';
        fi.disabled = false;
        si.disabled = false;
    } else {
        nf.classList.remove('d-none');
        df.classList.add('d-none');
        ni.disabled = false;
        fi.disabled = true;
        si.disabled = true;
        fi.value = '';
        si.value = '';
    }
}

function setupSonDaughterAutoGender() {
    var sd = document.getElementById('sonDaughterSelect');
    var mg = document.getElementById('minorGenderSelect');
    if (sd && mg) {
        sd.addEventListener('change', function () {
            if (this.value.toLowerCase() === 'son') mg.value = 'MALE';
            else if (this.value.toLowerCase() === 'daughter') mg.value = 'FEMALE';
        });
    }
}

// ==================== UPPERCASE INPUTS ====================
function setupUppercaseInputs() {
    document.querySelectorAll('.uppercase-input').forEach(function (i) {
        i.addEventListener('input', function () {
            var s = this.selectionStart;
            var e = this.selectionEnd;
            this.value = this.value.toUpperCase();
            this.setSelectionRange(s, e);
        });
    });
}

// ==================== TEMPLATE SELECTION ====================
function selectTemplate(t) {
    if (!t) return;

    selectedTemplate = t;
    document.getElementById('template_type').value = t;
    document.getElementById('processForm').classList.remove('d-none');

    // Disable all template sections
    document.querySelectorAll('.template-form-section').forEach(function (s) {
        s.classList.remove('active');
        s.querySelectorAll('input,select,textarea').forEach(function (i) {
            i.disabled = true;
        });
    });

    // Enable selected template section
    var ts = document.querySelector('.template-form-section[data-template="' + t + '"]');
    if (ts) {
        ts.classList.add('active');
        ts.querySelectorAll('input,select,textarea').forEach(function (i) {
            i.disabled = false;
        });
    }

    document.getElementById('commonSections').classList.remove('d-none');
    document.getElementById('templateFilesInfo').classList.remove('d-none');

    // Clear aliases
    clearAliases('major');
    clearAliases('minor');
    clearAliases('religion');

    // Fetch template files
    fetchTemplateFiles(t);

    // Hide result sections
    document.getElementById('previewSection').classList.add('d-none');
    document.getElementById('draftSavedSection').classList.add('d-none');
    var submittedSection = document.getElementById('submittedSection');
    if (submittedSection) submittedSection.classList.add('d-none');

    // Initialize event listeners
    initializeEventListeners();

    // Clear and fill phones
    clearAllPhoneInputs();
    setTimeout(function () {autoFillAllPhones();}, 200);

    // Re-attach name validation for newly visible fields
    setTimeout(() => initNameFieldValidation(), 100);


    // Scroll to form
    setTimeout(function () {document.getElementById('processForm').scrollIntoView({ behavior: 'smooth', block: 'start' });}, 100);
}

function fetchTemplateFiles(t) {
    fetch('/get_template_config/' + t)
        .then(function (r) { return r.json(); })
        .then(function (d) {
            if (d.success) updateTemplateFilesUI(d.templates, d.count, 'main');
        })
        .catch(function (e) {
            console.error(e);
            showToast('error', 'Error', 'Failed to load templates');
        });
}

function fetchTemplatesByRelation(t, r) {
    var fc = document.getElementById('templateFilesContainer');
    fc.classList.add('files-updating');

    fetch('/get_templates_by_relation/' + t + '/' + r)
        .then(function (res) { return res.json(); })
        .then(function (d) {
            if (d.success) {
                updateTemplateFilesUI(d.templates, d.count, d.folder_type);
            }
        })
        .finally(function () {
            fc.classList.remove('files-updating');
        });
}

function updateTemplateFilesUI(templates, count, folderType) {
    templateFileCount = count;
    currentFolderType = folderType;
    document.getElementById('current_folder_type').value = folderType;
    document.getElementById('templateFilesSection').classList.remove('d-none');

    var html = templates.length > 0 ?
        templates.map(function (f) {
            return '<span class="file-badge"><i class="bi bi-file-earmark-word me-1"></i>' + f + '</span>';
        }).join('') :
        '<span class="text-muted small">No templates</span>';

    document.getElementById('templateFilesContainer').innerHTML = html;
    document.getElementById('templateFileCount').textContent = count;

    var fb = document.getElementById('folderTypeBadge');
    if (selectedTemplate === 'major_template' || selectedTemplate === 'religion_template') {
        fb.classList.remove('d-none', 'unmarried', 'main');
        if (folderType === 'unmarried') {
            fb.classList.add('unmarried');
            fb.textContent = 'Unmarried';
        } else {
            fb.classList.add('main');
            fb.textContent = 'Main';
        }
    } else {
        fb.classList.add('d-none');
    }

    document.getElementById('previewBtn').disabled = count === 0;
}

// ==================== DATE HANDLING ====================
function updateNumDate() {
    var dp = document.getElementById('num_date_picker');
    var pr = document.getElementById('numDatePreview');
    var pv = document.getElementById('numDatePreviewValue');
    var hf = document.getElementById('num_date');
    var af = document.getElementById('alpha_date');

    if (dp.value) {
        var d = new Date(dp.value);
        var day = padDay(d.getDate());
        var mon = padDay(d.getMonth() + 1);
        var yr = d.getFullYear();
        var fmt = day + '/' + mon + '/' + yr;
        pv.textContent = fmt;
        hf.value = fmt;
        pr.style.display = 'block';

        if (document.getElementById('syncDates').checked) {
            var suf = getOrdinalSuffix(d.getDate());
            var mn = monthNames[d.getMonth()];
            af.value = day + suf + ' Day of ' + mn + ' ' + yr;
        }
    } else {
        pr.style.display = 'none';
        hf.value = '';
        af.value = '';
    }
}

// ==================== FORM VALIDATION ====================
function validateForm() {
    var as = document.querySelector('.template-form-section.active');
    if (!as) {
        showToast('error', 'Error', 'Select a template');
        return false;
    }

    var valid = true, first = null, msg = 'Fill all required fields';

    // Check required fields in active section
    as.querySelectorAll('[data-required="true"]:not(:disabled)').forEach(function (f) {
        var pc = f.closest('.col-md-6,.col-md-4,.col-12');
        if (pc && pc.classList.contains('d-none')) return;
        if (!f.value.trim()) {
            valid = false;
            f.classList.add('is-invalid');
            if (!first) first = f;
        } else {
            f.classList.remove('is-invalid');
        }
    });

    // Check common sections
    var cs = document.getElementById('commonSections');
    if (cs && !cs.classList.contains('d-none')) {
        cs.querySelectorAll('[data-required="true"]:not(:disabled)').forEach(function (f) {
            if (!f.value.trim()) {
                valid = false;
                f.classList.add('is-invalid');
                if (!first) first = f;
            } else {
                f.classList.remove('is-invalid');
            }
        });
    }

    // Phone validation with duplicate check
    var phoneValues = [];
    var allPhones = [];

    as.querySelectorAll('.phone-input:not(:disabled)').forEach(function (inp) { allPhones.push(inp); });
    if (cs) cs.querySelectorAll('.phone-input:not(:disabled)').forEach(function (inp) { allPhones.push(inp); });

    allPhones.forEach(function (i) {
        var parentCol = i.closest('.col-md-4, .col-md-6, .col-12');
        if (parentCol && parentCol.classList.contains('d-none')) return;

        var l = i.value.trim().length;
        var req = i.hasAttribute('data-required');

        if (req && l === 0) {
            valid = false;
            i.classList.add('is-invalid');
            if (!first) { first = i; msg = 'Phone required'; }
        } else if (l > 0 && l !== 10) {
            valid = false;
            i.classList.add('is-invalid');
            if (!first) { first = i; msg = 'Phone must be 10 digits'; }
        } else if (l === 10) {
            if (phoneValues.indexOf(i.value) !== -1) {
                valid = false;
                i.classList.add('is-invalid');
                if (!first) { first = i; msg = 'Duplicate phone numbers!'; }
            } else {
                phoneValues.push(i.value);
                i.classList.remove('is-invalid');
                i.classList.add('is-valid');
            }
        }
    });

    // Minor age validation
    if (selectedTemplate === 'minor_template') {
        var ageInput = document.getElementById('minor_update_age');
        var dobInput = document.getElementById('minor_child_dob');

        if (ageInput && dobInput && ageInput.value) {
            var age = parseInt(ageInput.value);
            if (age >= 18) {
                valid = false;
                ageInput.classList.add('is-invalid');
                dobInput.classList.add('is-invalid');
                if (!first) { first = dobInput; msg = 'Person is ' + age + ' years. Use Major template!'; }
            }
        }
    }

    if (!valid && first) {
        scrollToElement(first);
        showToast('error', 'Validation', msg);
    }
    return valid;
}

// ==================== PREVIEW ====================
function showPreview() {
    if (!validateForm()) return;

    var form = document.getElementById('processForm');
    var fd = new FormData(form);

    var p = 'major';
    if (selectedTemplate === 'minor_template') p = 'minor';
    else if (selectedTemplate === 'religion_template') p = 'religion';

    fd.set('old_name', buildOldNameWithAliases(p));

    // ✅ FIX: Explicitly get phone from the ACTIVE template's phone input
    var activePhoneInput = document.getElementById(p + '_phone_update');
    if (activePhoneInput) {
        fd.set('phone_update', activePhoneInput.value.trim());
    }

    var btn = document.getElementById('previewBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Loading...';

    // Validate name fields
    if (!validateAllNameFields()) {
        showToast('warning', 'Invalid Input', 'Name fields cannot contain numbers.');
        return;
    }
    
    fetch('/preview', { method: 'POST', body: fd })
        .then(function (r) { return r.json(); })
        .then(function (res) {
            if (res.success) {
                previewData = res;
                displayPreview(res);
                document.getElementById('processForm').classList.add('d-none');
                document.getElementById('previewSection').classList.remove('d-none');
                document.getElementById('previewSection').scrollIntoView({ behavior: 'smooth' });
            } else {
                showToast('error', 'Error', res.message);
            }
        })
        .catch(function (e) {
            console.error(e);
            showToast('error', 'Error', 'Preview failed');
        })
        .finally(function () {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-eye-fill me-2"></i>Preview Document';
        });
}

function displayPreview(data) {
    var pc = document.getElementById('previewContent');
    document.getElementById('previewTemplateCount').textContent = data.template_count;
    var reps = data.replacements;

    var orderedKeys = [];
    var witnessFields = ['WITNESS_NAME1', 'WITNESS_PHONE1', 'WITNESS_ADDRESS1', 'WITNESS_NAME2', 'WITNESS_PHONE2', 'WITNESS_ADDRESS2'];

    previewFieldOrder.forEach(function (k) {
        if (hiddenPreviewFields.indexOf(k) !== -1) return;
        if (reps[k] && reps[k].trim()) orderedKeys.push(k);
    });

    Object.keys(reps).forEach(function (k) {
        if (hiddenPreviewFields.indexOf(k) !== -1) return;
        if (orderedKeys.indexOf(k) === -1 && reps[k] && reps[k].trim() && witnessFields.indexOf(k) === -1) {
            var insertIndex = orderedKeys.length;
            for (var i = 0; i < orderedKeys.length; i++) {
                if (witnessFields.indexOf(orderedKeys[i]) !== -1) {
                    insertIndex = i;
                    break;
                }
            }
            orderedKeys.splice(insertIndex, 0, k);
        }
    });

    var html = '';
    for (var i = 0; i < orderedKeys.length; i += 2) {
        var k1 = orderedKeys[i];
        var k2 = orderedKeys[i + 1];
        var l1 = fieldLabels[k1] || k1;
        var v1 = reps[k1];

        html += '<tr><td class="p-key">' + l1 + ':</td><td class="p-val" data-field="' + k1 + '" data-original="' + escapeHtml(v1) + '">' + escapeHtml(v1) + '</td>';

        if (k2) {
            var l2 = fieldLabels[k2] || k2;
            var v2 = reps[k2];
            html += '<td class="p-key">' + l2 + ':</td><td class="p-val" data-field="' + k2 + '" data-original="' + escapeHtml(v2) + '">' + escapeHtml(v2) + '</td>';
        } else {
            html += '<td></td><td></td>';
        }
        html += '</tr>';
    }
    pc.innerHTML = html;
    isEditMode = false;
    lockedFields = {};
}

function toggleEditMode() {
    isEditMode = !isEditMode;
    var eb = document.getElementById('editAllBtn');
    var sb = document.getElementById('savePreviewBtn');
    var vals = document.querySelectorAll('.preview-table .p-val[data-field]');

    if (isEditMode) {
        eb.innerHTML = '<i class="bi bi-x-circle me-1"></i>Cancel';
        sb.classList.remove('d-none');
        vals.forEach(function (v) {
            var f = v.dataset.field;
            if (lockedFields[f]) return;
            var cv = v.textContent;
            v.innerHTML = '<input type="text" value="' + escapeHtml(cv) + '">';
        });
    } else {
        eb.innerHTML = '<i class="bi bi-pencil-square me-1"></i>Edit';
        sb.classList.add('d-none');
        vals.forEach(function (v) {
            var f = v.dataset.field;
            if (lockedFields[f]) return;
            var inp = v.querySelector('input');
            if (inp) v.textContent = v.dataset.original;
        });
    }
}

function savePreviewChanges() {
    var vals = document.querySelectorAll('.preview-table .p-val[data-field]');
    var upd = {};

    vals.forEach(function (v) {
        var f = v.dataset.field;
        var inp = v.querySelector('input');
        if (inp) {
            var nv = inp.value.trim().toUpperCase();
            upd[f] = nv;
            v.dataset.original = nv;
            v.textContent = nv;
            v.classList.add('locked-value');
            lockedFields[f] = true;
        }
    });

    fetch('/update_preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replacements: upd })
    })
        .then(function (r) { return r.json(); })
        .then(function (res) {
            if (res.success) {
                showToast('success', 'Saved', 'Changes saved');
                isEditMode = false;
                document.getElementById('editAllBtn').innerHTML = '<i class="bi bi-pencil-square me-1"></i>Edit';
                document.getElementById('savePreviewBtn').classList.add('d-none');
            } else {
                showToast('error', 'Error', res.message);
            }
        });
}

function cancelPreview() {
    document.getElementById('previewSection').classList.add('d-none');
    document.getElementById('processForm').classList.remove('d-none');
    document.getElementById('processForm').scrollIntoView({ behavior: 'smooth' });
}

// ==================== SAVE DRAFT ====================
function saveDraft() {
    var btn = document.getElementById('draftBtn');
    if (!btn) return;

    var originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';

    var replacements = {};

    if (previewData && previewData.replacements) {
        for (var key in previewData.replacements) {
            replacements[key] = previewData.replacements[key] || '';
        }
    }

    // Get edited values from preview table
    document.querySelectorAll('.preview-table .p-val[data-field]').forEach(function (cell) {
        var field = cell.dataset.field;
        if (field) {
            replacements[field] = cell.textContent.trim();
        }
    });

    if (Object.keys(replacements).length === 0) {
        showToast('error', 'Error', 'No data to save');
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        return;
    }

    var draftData = {
        template_type: selectedTemplate,
        folder_type: currentFolderType,
        replacements: replacements,
        preview_data: {
            template_type: selectedTemplate,
            folder_type: currentFolderType,
            replacements: replacements
        },
        status: 'draft'
    };

    fetch('/api/drafts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftData)
    })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.success) {
                document.getElementById('previewSection').classList.add('d-none');

                var draftSavedSection = document.getElementById('draftSavedSection');
                if (draftSavedSection) {
                    draftSavedSection.classList.remove('d-none');
                    draftSavedSection.scrollIntoView({ behavior: 'smooth' });
                }

                showToast('success', 'Draft Saved', 'Phones marked as used: ' + (data.phones_marked || 0));
                currentFormPhones = {};
                loadPhoneStats();
            } else {
                showToast('error', 'Error', data.message || 'Failed to save draft');
            }
        })
        .catch(function (e) {
            console.error('Error saving draft:', e);
            showToast('error', 'Error', 'Failed to save draft');
        })
        .finally(function () {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        });
}

function submitForApproval() {
    var btn = document.getElementById('submitApprovalBtn');
    if (!btn) return;

    var originalHtml = btn.innerHTML;
    var spinner = document.getElementById('submitSpinner');
    var icon = document.getElementById('submitIcon');

    btn.disabled = true;
    if (spinner) spinner.classList.remove('d-none');
    if (icon) icon.classList.add('d-none');

    var replacements = {};

    if (previewData && previewData.replacements) {
        for (var key in previewData.replacements) {
            replacements[key] = previewData.replacements[key] || '';
        }
    }

    document.querySelectorAll('.preview-table .p-val[data-field]').forEach(function (cell) {
        var field = cell.dataset.field;
        if (field) {
            replacements[field] = cell.textContent.trim();
        }
    });

    var draftData = {
        template_type: selectedTemplate,
        folder_type: currentFolderType,
        replacements: replacements,
        preview_data: {
            template_type: selectedTemplate,
            folder_type: currentFolderType,
            replacements: replacements
        },
        status: 'draft'
    };

    fetch('/api/drafts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftData)
    })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.success && data.draft_id) {
                return fetch('/api/drafts/' + data.draft_id + '/submit-approval', {
                    method: 'POST'
                })
                    .then(function (r) { return r.json(); })
                    .then(function (approvalData) {
                        if (approvalData.success) {
                            document.getElementById('previewSection').classList.add('d-none');

                            var submittedSection = document.getElementById('submittedSection');
                            if (submittedSection) {
                                submittedSection.classList.remove('d-none');
                                submittedSection.scrollIntoView({ behavior: 'smooth' });
                            }

                            showToast('success', 'Submitted', 'Document submitted for approval!');
                            currentFormPhones = {};
                            loadPhoneStats();
                        } else {
                            showToast('error', 'Error', approvalData.message);
                        }
                    });
            } else {
                showToast('error', 'Error', data.message);
            }
        })
        .catch(function (e) {
            console.error('Error:', e);
            showToast('error', 'Error', 'Failed to submit');
        })
        .finally(function () {
            btn.disabled = false;
            if (spinner) spinner.classList.add('d-none');
            if (icon) icon.classList.remove('d-none');
        });
}

// ==================== RESET FORM ====================
function resetForm() {
    var form = document.getElementById('processForm');
    form.reset();

    form.querySelectorAll('.is-invalid,.is-valid').forEach(function (e) {
        e.classList.remove('is-invalid', 'is-valid');
    });

    clearAllPhoneInputs();
    clearAliases('major');
    clearAliases('minor');
    clearAliases('religion');

    form.classList.remove('d-none');
    document.getElementById('previewSection').classList.add('d-none');
    document.getElementById('draftSavedSection').classList.add('d-none');

    var submittedSection = document.getElementById('submittedSection');
    if (submittedSection) submittedSection.classList.add('d-none');

    document.getElementById('templateFilesInfo').classList.remove('d-none');

    currentFormPhones = {};

    if (selectedTemplate) {
        fetchTemplateFiles(selectedTemplate);
        setTimeout(autoFillAllPhones, 300);
    }

    document.querySelector('.template-selector-card').scrollIntoView({ behavior: 'smooth' });
}

// ==================== TOAST ====================
function showToast(type, title, msg) {
    var t = document.getElementById('toast');
    var ti = document.getElementById('toastIcon');
    var tt = document.getElementById('toastTitle');
    var tb = document.getElementById('toastBody');

    ti.className = 'bi me-2';
    var icons = {
        'success': 'bi-check-circle-fill text-success',
        'warning': 'bi-exclamation-triangle-fill text-warning',
        'info': 'bi-info-circle-fill text-info',
        'error': 'bi-exclamation-triangle-fill text-danger'
    };
    (icons[type] || icons['error']).split(' ').forEach(function (c) {
        ti.classList.add(c);
    });
    tt.textContent = title;
    tb.textContent = msg;

    new bootstrap.Toast(t).show();
}

// ==================== INITIALIZATION ====================
function initializeEventListeners() {
    setupUppercaseInputs();
    setupSonDaughterAutoGender();
    setupPhoneValidation();
    setupRelationAutoGender();
    setupDOBAutoAge();
}

document.addEventListener('DOMContentLoaded', function () {
    var datePicker = document.getElementById('num_date_picker');
    if (datePicker) {
        datePicker.addEventListener('change', updateNumDate);
    }

    initializeEventListeners();
    loadPhoneStats();
    updateTime();
    initNameFieldValidation();
    setInterval(updateTime, 60000);
});


// ==================== NAME FIELD VALIDATION ====================

/**
 * Validates name fields - allows only letters, spaces, hyphens, apostrophes, and dots
 * Prevents numbers and most special characters
 */
function initNameFieldValidation() {
    const nameFieldSelectors = [
        'input[name="old_name"]',
        'input[name="new_name"]',
        'input[name="fatherspouse_name"]',
        'input[name="father_name"]',
        'input[name="spouse_name"]',
        'input[name="fathermother_name"]',
        'input[name="guardian_father_name"]',
        'input[name="guardian_spouse_name"]',
        'input[name="witness_name1"]',
        'input[name="witness_name2"]',
        '#major_old_name',
        '#major_fatherspouse_name',
        '#major_father_name',
        '#major_spouse_name',
        '#minor_old_name',
        '#minor_fathermother_name',
        '#minor_fatherspouse_name',
        '#minor_guardian_father_name',
        '#minor_guardian_spouse_name',
        '#religion_old_name',
        '#religion_fatherspouse_name',
        '#religion_father_name',
        '#religion_spouse_name',
    ];

    const processedInputs = new Set();

    nameFieldSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(input => {
            if (!processedInputs.has(input)) {
                processedInputs.add(input);
                attachNameValidation(input);
            }
        });
    });

    observeAliasContainers();
}

/**
 * Attaches name validation events to a specific input element
 */
function attachNameValidation(input) {
    input.setAttribute('data-name-field', 'true');
    input.addEventListener('keydown', handleNameKeydown);
    input.addEventListener('input', handleNameInput);
    input.addEventListener('paste', handleNamePaste);
}

/**
 * Handles keydown event - blocks number keys and special chars
 */
function handleNameKeydown(e) {
    const allowedKeys = [
        'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'Home', 'End', 'Shift', 'Control', 'Alt', 'Meta',
        'CapsLock', 'F1', 'F2', 'F3', 'F4', 'F5',
        'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
    ];

    if (e.ctrlKey || e.metaKey) return;
    if (allowedKeys.includes(e.key)) return;
    if (/^[a-zA-Z]$/.test(e.key)) return;
    if (e.key === ' ' || e.key === '-' || e.key === "'" || e.key === '.') return;

    e.preventDefault();
    showNameFieldError(e.target);
}

/**
 * Handles input event - cleans pasted/autofilled content
 */
function handleNameInput(e) {
    const input = e.target;
    const originalValue = input.value;
    const cursorPos = input.selectionStart;

    const cleanedValue = originalValue.replace(/[^a-zA-Z\s\-'.]/g, '');

    if (cleanedValue !== originalValue) {
        const diff = originalValue.length - cleanedValue.length;
        const newCursorPos = Math.max(0, cursorPos - diff);
        input.value = cleanedValue;

        try {
            input.setSelectionRange(newCursorPos, newCursorPos);
        } catch (err) {}

        showNameFieldError(input);
    } else {
        // Clear error if input is now valid
        clearNameFieldError(input);
    }
}

/**
 * Handles paste event - cleans pasted content
 */
function handleNamePaste(e) {
    e.preventDefault();

    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
    const cleanedText = pastedText.replace(/[^a-zA-Z\s\-'.]/g, '');

    const input = e.target;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const currentValue = input.value;

    input.value = currentValue.substring(0, start) + cleanedText + currentValue.substring(end);

    const newPos = start + cleanedText.length;
    try {
        input.setSelectionRange(newPos, newPos);
    } catch (err) {}

    input.dispatchEvent(new Event('input', { bubbles: true }));

    if (cleanedText !== pastedText) {
        showNameFieldError(input, 'Numbers & symbols removed');
    }
}

/**
 * Shows a single error message below the field - no duplicates
 */
function showNameFieldError(input, message = 'Only letters allowed') {
    // Find the wrapper - could be col-md-4, col-12, or the field's parent
    const wrapper = input.closest('.col-md-4, .col-md-6, .col-12') || input.parentElement;

    // Check if error already exists - don't add another
    let errorEl = wrapper.querySelector('.name-field-error');

    if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.className = 'name-field-error';
        wrapper.appendChild(errorEl);
    }

    // Update message
    errorEl.innerHTML = `<i class="bi bi-exclamation-circle me-1"></i>${message}`;

    // Clear any existing timer on this element
    if (errorEl._hideTimer) {
        clearTimeout(errorEl._hideTimer);
    }

    // Shake the input
    input.classList.add('name-field-shake');
    setTimeout(() => input.classList.remove('name-field-shake'), 400);

    // Auto-hide after 2.5 seconds
    errorEl._hideTimer = setTimeout(() => {
        if (errorEl.parentElement) {
            errorEl.classList.add('name-field-error--hiding');
            setTimeout(() => errorEl.remove(), 300);
        }
    }, 2500);
}

/**
 * Clears error message for a specific input
 */
function clearNameFieldError(input) {
    const wrapper = input.closest('.col-md-4, .col-md-6, .col-12') || input.parentElement;
    const errorEl = wrapper.querySelector('.name-field-error');
    if (errorEl) {
        if (errorEl._hideTimer) clearTimeout(errorEl._hideTimer);
        errorEl.remove();
    }
}

/**
 * Observes alias containers for dynamically added alias input fields
 */
function observeAliasContainers() {
    const aliasContainers = document.querySelectorAll(
        '#major_alias_container, #minor_alias_container, #religion_alias_container'
    );

    aliasContainers.forEach(container => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const aliasInputs = node.querySelectorAll
                            ? node.querySelectorAll('input.alias-input')
                            : [];
                        aliasInputs.forEach(input => attachNameValidation(input));

                        if (node.classList && node.classList.contains('alias-input')) {
                            attachNameValidation(node);
                        }
                    }
                });
            });
        });

        observer.observe(container, { childList: true, subtree: true });
    });
}

/**
 * Validates all name fields before form submission
 */
function validateAllNameFields() {
    const activeSection = document.querySelector('.template-form-section.active');
    if (!activeSection) return true;

    const witnessSection = document.getElementById('commonSections');
    const nameInputs = [
        ...activeSection.querySelectorAll('[data-name-field="true"]'),
        ...(witnessSection ? witnessSection.querySelectorAll('[data-name-field="true"]') : [])
    ];

    let allValid = true;
    let firstInvalidInput = null;

    nameInputs.forEach(input => {
        if (input.offsetParent !== null && input.value.trim() !== '') {
            const hasNumbers = /\d/.test(input.value);
            const hasInvalidChars = /[^a-zA-Z\s\-'.]/.test(input.value);

            if (hasNumbers || hasInvalidChars) {
                showNameFieldError(input, 'Only letters allowed');
                allValid = false;
                if (!firstInvalidInput) firstInvalidInput = input;
            }
        }
    });

    if (firstInvalidInput) {
        firstInvalidInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstInvalidInput.focus();
    }

    return allValid;
}
