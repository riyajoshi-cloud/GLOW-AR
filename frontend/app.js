// GLOW AR Application Logic

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================================================
    // State Management & Backend Config
    // ==========================================================================
    const API_BASE = 'https://glow-ar.onrender.com/api';
    let skinMLModel = null;
    let authToken = localStorage.getItem('glowar_token') || null;
    let userProfile = null;
    let currentImageElement = new Image();
    let webcamStream = null;
    let liveTrackingInterval = null;
    let isLiveRendering = false;
    
    let faceLandmarker = null;
    const aiStatusTag = document.getElementById('ai-status-tag');
    
    // Core AR makeup state
    const makeupState = {
        lips: { color: '#e63946', finish: 'matte', opacity: 0, name: 'None', expand: 0 },
        cheeks: { color: '#ff87ab', opacity: 0, name: 'None', expand: 35 },
        eyes: { color: '#ffb703', opacity: 0, name: 'None', expand: 25 }
    };
    
    // Coordinates mapping for face landmarks: normalized coordinates (0 to 1) relative to image size
    const presetsLandmarks = [
        { // Model 1: Aria
            leftEye: { x: 0.38, y: 0.37 },
            rightEye: { x: 0.62, y: 0.37 },
            leftCheek: { x: 0.32, y: 0.54 },
            rightCheek: { x: 0.68, y: 0.54 },
            lipLeft: { x: 0.42, y: 0.70 },
            lipRight: { x: 0.58, y: 0.70 },
            lipTop: { x: 0.50, y: 0.66 },
            lipBottom: { x: 0.50, y: 0.75 }
        },
        { // Model 2: Chloe
            leftEye: { x: 0.43, y: 0.44 },
            rightEye: { x: 0.57, y: 0.44 },
            leftCheek: { x: 0.37, y: 0.56 },
            rightCheek: { x: 0.63, y: 0.56 },
            lipLeft: { x: 0.45, y: 0.71 },
            lipRight: { x: 0.55, y: 0.71 },
            lipTop: { x: 0.50, y: 0.68 },
            lipBottom: { x: 0.50, y: 0.75 }
        },
        { // Model 3: Kavya
            leftEye: { x: 0.41, y: 0.43 },
            rightEye: { x: 0.59, y: 0.43 },
            leftCheek: { x: 0.36, y: 0.53 },
            rightCheek: { x: 0.64, y: 0.53 },
            lipLeft: { x: 0.45, y: 0.67 },
            lipRight: { x: 0.55, y: 0.67 },
            lipTop: { x: 0.50, y: 0.64 },
            lipBottom: { x: 0.50, y: 0.71 }
        },
        { // Model 4: Zuri
            leftEye: { x: 0.39, y: 0.39 },
            rightEye: { x: 0.61, y: 0.39 },
            leftCheek: { x: 0.33, y: 0.53 },
            rightCheek: { x: 0.67, y: 0.53 },
            lipLeft: { x: 0.44, y: 0.68 },
            lipRight: { x: 0.56, y: 0.68 },
            lipTop: { x: 0.50, y: 0.65 },
            lipBottom: { x: 0.50, y: 0.72 }
        }
    ];

    // Current picture config layout landmarks
    let activeLandmarks = JSON.parse(JSON.stringify(presetsLandmarks[0]));
    
    // View/calibration toggles
    let splitRatio = 0.5; // vertical compare line slider percentage
    let isCompareMode = true;
    let isCalibrationMode = false;
    let isDraggingNode = null;
    let cartStorage = [];

    // ==========================================================================
    // DOM Element Selectors
    // ==========================================================================
    
    // Auth screens
    const authScreen = document.getElementById('auth-screen');
    const appScreen = document.getElementById('app-screen');
    const signupFormWrapper = document.getElementById('signup-form-wrapper');
    const loginFormWrapper = document.getElementById('login-form-wrapper');
    const signupForm = document.getElementById('signup-form');
    const loginForm = document.getElementById('login-form');
    
    const signupNameInput = document.getElementById('signup-name');
    const signupEmailInput = document.getElementById('signup-email');
    const signupPwdInput = document.getElementById('signup-password');
    const loginEmailInput = document.getElementById('login-email');
    const loginPwdInput = document.getElementById('login-password');
    
    const pwdStrengthBar = document.getElementById('strength-bar');
    const pwdStrengthText = document.getElementById('strength-text');
    const togglePwdBtn = document.getElementById('toggle-pwd');
    const toggleLoginPwdBtn = document.getElementById('toggle-login-pwd');
    const termsAgreeChk = document.getElementById('terms-agree');
    const toLoginLink = document.getElementById('to-login');
    const toSignupLink = document.getElementById('to-signup');
    
    // App header labels
    const userNameLbl = document.getElementById('user-name-lbl');
    const userAvatarLbl = document.getElementById('user-avatar-lbl');
    const logoutBtn = document.getElementById('logout-btn');
    
    // Mobile navigation selectors
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileNavDrawer = document.getElementById('mobile-nav-drawer');
    const closeDrawerBtn = document.getElementById('close-drawer-btn');
    const drawerLinks = document.querySelectorAll('.drawer-link');
    const drawerUserName = document.getElementById('drawer-user-name');
    
    // Workspaces
    const camTabs = document.querySelectorAll('.cam-tab');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const presetsPanel = document.getElementById('presets-panel');
    const uploadPanel = document.getElementById('upload-panel');
    const cameraPanel = document.getElementById('camera-panel');
    const presetItems = document.querySelectorAll('.preset-item');
    
    // Viewer canvas items
    const viewportContainer = document.getElementById('canvas-viewport');
    const arCanvas = document.getElementById('ar-canvas');
    const ctx = arCanvas.getContext('2d');
    const splitSliderLine = document.getElementById('split-line');
    const splitHandle = document.querySelector('.split-handle');
    const calibrationOverlay = document.getElementById('calibration-overlay');
    const calNodes = document.querySelectorAll('.cal-node');
    const scannerLayer = document.getElementById('scanner-layer');
    
    // Toolbar buttons
    const btnToggleCalibration = document.getElementById('btn-toggle-calibration');
    const btnToggleCompare = document.getElementById('btn-toggle-compare');
    const btnScanSkin = document.getElementById('btn-scan-skin');
    const btnResetFilters = document.getElementById('btn-reset-filters');
    
    // Webcam indicators
    const webcamFeed = document.getElementById('webcam-feed');
    const cameraError = document.getElementById('camera-error');
    const btnCapture = document.getElementById('btn-capture');
    
    // File inputs
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const uploadTriggerBtn = document.getElementById('upload-trigger-btn');
    
    // Adjust tabs and palettes
    const categoryBtns = document.querySelectorAll('.cat-btn');
    const catPanels = document.querySelectorAll('.cat-panel');
    
    const lipsPalette = document.getElementById('lips-palette');
    const lipsShadeLbl = document.getElementById('lips-shade-lbl');
    const lipsFinishGroup = document.getElementById('lips-finish-group');
    const lipsOpacityRange = document.getElementById('lips-opacity');
    const lipsOpacityGauge = document.getElementById('lips-opacity-lbl');
    
    const cheeksPalette = document.getElementById('cheeks-palette');
    const cheeksShadeLbl = document.getElementById('cheeks-shade-lbl');
    const cheeksOpacityRange = document.getElementById('cheeks-opacity');
    const cheeksOpacityGauge = document.getElementById('cheeks-opacity-lbl');
    const cheeksExpandRange = document.getElementById('cheeks-expand');
    const cheeksExpandGauge = document.getElementById('cheeks-expand-lbl');
    
    const lipsExpandRange = document.getElementById('lips-expand');
    const lipsExpandGauge = document.getElementById('lips-expand-lbl');
    
    const eyesPalette = document.getElementById('eyes-palette');
    const eyesShadeLbl = document.getElementById('eyes-shade-lbl');
    const eyesOpacityRange = document.getElementById('eyes-opacity');
    const eyesOpacityGauge = document.getElementById('eyes-opacity-lbl');
    const eyesExpandRange = document.getElementById('eyes-expand');
    const eyesExpandGauge = document.getElementById('eyes-expand-lbl');
    
    // Cart actions
    const cartCountLbl = document.querySelector('.cart-count');
    const cartBtn = document.getElementById('cart-btn');
    const cartDropdown = document.getElementById('cart-dropdown');
    const cartDropdownCount = document.getElementById('cart-dropdown-count');
    const cartItemsList = document.getElementById('cart-items-list');
    const cartSubtotalVal = document.querySelector('.cart-subtotal-val');
    const addComboBtn = document.getElementById('add-combo-to-cart');
    const activeFormulaTitle = document.getElementById('active-formula-title');
    const activeFormulaDesc = document.getElementById('active-formula-desc');
    const activeFormulaPrice = document.getElementById('active-formula-price');
    const checkoutBtn = document.getElementById('checkout-btn');
    
    // Checkout Invoice modal selectors
    const checkoutModal = document.getElementById('checkout-modal');
    const closeCheckoutModal = document.getElementById('close-checkout-modal');
    const btnModalDone = document.getElementById('btn-modal-done');
    const invoiceTxnId = document.getElementById('invoice-txn-id');
    const invoiceEmail = document.getElementById('invoice-email');
    const invoiceTotal = document.getElementById('invoice-total');
    const invoiceProductsList = document.getElementById('invoice-products-list');
    
    // Catalog details
    const catalogProductsGrid = document.getElementById('catalog-products-grid');
    
    // AI diagnostics output
    const skinDiagnosticsSection = document.getElementById('skin-anchor');
    const skinDiagnosticsResultsGrid = document.getElementById('skin-diagnostics-results-grid');
    const skinHistoryList = document.getElementById('skin-history-list');
    const orderHistoryList = document.getElementById('order-history-list');
    
    const radialScoreCircle = document.getElementById('health-score-circle');
    const scoreTextLbl = document.getElementById('health-score-txt');
    const valHydration = document.getElementById('val-hydration');
    const barHydration = document.getElementById('bar-hydration');
    const valUniformity = document.getElementById('val-uniformity');
    const barUniformity = document.getElementById('bar-uniformity');
    const valRedness = document.getElementById('val-redness');
    const barRedness = document.getElementById('bar-redness');
    const valSpots = document.getElementById('val-spots');
    const barSpots = document.getElementById('bar-spots');

    // ==========================================================================
    // Initialization & Presets Loader
    // ==========================================================================
    
    // Pre-load default base model photo
    currentImageElement.crossOrigin = 'anonymous';
    currentImageElement.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80';
    currentImageElement.onload = () => {
        setupCanvasDimensions();
        
        // Check if AI face detector is ready, otherwise load and run
        if (faceLandmarker) {
            runAutoFaceDetection(currentImageElement);
        } else {
            renderTryOn();
            initFaceDetector().then(() => {
                if (faceLandmarker) runAutoFaceDetection(currentImageElement);
            });
        }
    };

    window.addEventListener('resize', () => {
        setupCanvasDimensions();
        renderTryOn();
        if (isCalibrationMode) alignCalibrationNodes();
    });

    async function initFaceDetector() {
        if (faceLandmarker) return;
        try {
            console.log("Loading AI face detector models...");
            const { FilesetResolver, FaceLandmarker: FL } = await import(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs"
            );
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
            );
            faceLandmarker = await FL.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
                },
                runningMode: "IMAGE",
                numFaces: 1
            });
            console.log("AI face detector model initialized.");
        } catch (err) {
            console.error("AI face detector model load failed:", err);
        }
    }

    async function runAutoFaceDetection(imgElement) {
        if (!faceLandmarker) return;
        
        if (aiStatusTag) {
            aiStatusTag.querySelector('.status-text').innerText = "AI Auto-Aligning...";
            aiStatusTag.classList.add('active');
        }
        
        try {
            const result = faceLandmarker.detect(imgElement);
            if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
                const landmarks = result.faceLandmarks[0];
                
                const outerLipUpperIndices = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291];
                const outerLipLowerIndices = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291];
                const innerLipUpperIndices = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
                const innerLipLowerIndices = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308];
                const eyesLidLeftIndices = [33, 246, 161, 160, 159, 158, 157, 173, 133];
                const eyesLidRightIndices = [263, 466, 388, 387, 386, 385, 384, 398, 362];

                activeLandmarks = {
                    leftEye: { 
                        x: (landmarks[33].x + landmarks[133].x) / 2, 
                        y: (landmarks[33].y + landmarks[133].y) / 2 
                    },
                    rightEye: { 
                        x: (landmarks[263].x + landmarks[362].x) / 2, 
                        y: (landmarks[263].y + landmarks[362].y) / 2 
                    },
                    leftCheek: { x: landmarks[234].x, y: landmarks[234].y },
                    rightCheek: { x: landmarks[454].x, y: landmarks[454].y },
                    lipLeft: { x: landmarks[61].x, y: landmarks[61].y },
                    lipRight: { x: landmarks[291].x, y: landmarks[291].y },
                    lipTop: { x: landmarks[13].x, y: landmarks[13].y },
                    lipBottom: { x: landmarks[14].x, y: landmarks[14].y },
                    lipsOuterUpper: outerLipUpperIndices.map(idx => ({ x: landmarks[idx].x, y: landmarks[idx].y })),
                    lipsOuterLower: outerLipLowerIndices.map(idx => ({ x: landmarks[idx].x, y: landmarks[idx].y })),
                    lipsInnerUpper: innerLipUpperIndices.map(idx => ({ x: landmarks[idx].x, y: landmarks[idx].y })),
                    lipsInnerLower: innerLipLowerIndices.map(idx => ({ x: landmarks[idx].x, y: landmarks[idx].y })),
                    leftEyeLid: eyesLidLeftIndices.map(idx => ({ x: landmarks[idx].x, y: landmarks[idx].y })),
                    rightEyeLid: eyesLidRightIndices.map(idx => ({ x: landmarks[idx].x, y: landmarks[idx].y }))
                };
                
                console.log("AI Auto-Alignment success:", activeLandmarks);
                if (aiStatusTag) {
                    aiStatusTag.querySelector('.status-text').innerText = "AI Face Tracking Active";
                    aiStatusTag.classList.add('active');
                }
                
                renderTryOn();
                if (isCalibrationMode) alignCalibrationNodes();
            } else {
                console.warn("AI face detector could not find face features, keeping default/preset landmarks.");
                if (aiStatusTag) {
                    aiStatusTag.classList.remove('active');
                }
            }
        } catch (err) {
            console.error("Auto face detection process error:", err);
            if (aiStatusTag) {
                aiStatusTag.classList.remove('active');
            }
        }
    }

    // Preload face detector immediately on site load
    initFaceDetector();

    function setupCanvasDimensions() {
        // Maintain image ratio matches inside viewfinder base card
        const maxDisplayWidth = viewportContainer.clientWidth || 550;
        const maxDisplayHeight = 520;
        
        let ratio = 1;
        if (webcamStream) {
            ratio = (webcamFeed.videoHeight / webcamFeed.videoWidth) || (3/4);
        } else {
            ratio = currentImageElement.naturalHeight / currentImageElement.naturalWidth || 1;
        }
        
        let drawWidth = maxDisplayWidth;
        let drawHeight = drawWidth * ratio;
        
        if (drawHeight > maxDisplayHeight) {
            drawHeight = maxDisplayHeight;
            drawWidth = drawHeight / ratio;
        }
        
        arCanvas.width = drawWidth;
        arCanvas.height = drawHeight;

        const canvasContainer = document.getElementById('canvas-container');
        if (canvasContainer) {
            canvasContainer.style.width = `${drawWidth}px`;
            canvasContainer.style.height = `${drawHeight}px`;
        }

        if (splitSliderLine) {
            splitSliderLine.style.left = `${splitRatio * 100}%`;
        }
    }

    // ==========================================================================
    // Luxury Toast Notification System
    // ==========================================================================
    function showLuxuryToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `luxury-toast ${type}`;
        
        let icon = '<i class="fa-solid fa-circle-check" style="color: #2ec4b6;"></i>';
        if (type === 'error') {
            icon = '<i class="fa-solid fa-circle-exclamation" style="color: #e63946;"></i>';
        } else if (type === 'info') {
            icon = '<i class="fa-solid fa-circle-info" style="color: var(--primary);"></i>';
        }
        
        toast.innerHTML = `${icon}<span>${message}</span>`;
        container.appendChild(toast);
        
        // Auto-remove after animation ends (4s total duration defined in CSS)
        setTimeout(() => {
            toast.remove();
        }, 4000);
    }

    // ==========================================================================
    // Auth UI Interactions, Validations & Backend Synchronization
    // ==========================================================================
    
    // Toggle Password visibility for Sign Up
    togglePwdBtn.addEventListener('click', () => {
        const type = signupPwdInput.getAttribute('type') === 'password' ? 'text' : 'password';
        signupPwdInput.setAttribute('type', type);
        togglePwdBtn.innerHTML = type === 'password' ? '<i class="fa-regular fa-eye"></i>' : '<i class="fa-regular fa-eye-slash"></i>';
    });

    // Toggle Password visibility for Log In
    if (toggleLoginPwdBtn) {
        toggleLoginPwdBtn.addEventListener('click', () => {
            const type = loginPwdInput.getAttribute('type') === 'password' ? 'text' : 'password';
            loginPwdInput.setAttribute('type', type);
            toggleLoginPwdBtn.innerHTML = type === 'password' ? '<i class="fa-regular fa-eye"></i>' : '<i class="fa-regular fa-eye-slash"></i>';
        });
    }

    // Toggle between Sign Up and Login Forms
    if (toLoginLink && toSignupLink) {
        toLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            signupFormWrapper.classList.add('hidden');
            loginFormWrapper.classList.remove('hidden');
        });
        
        toSignupLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginFormWrapper.classList.add('hidden');
            signupFormWrapper.classList.remove('hidden');
        });
    }

    // Password strength check
    signupPwdInput.addEventListener('input', () => {
        let val = signupPwdInput.value;
        let strength = 0;
        
        if (val.length >= 6) strength = 1;
        if (/[A-Z]/.test(val) && /[0-9]/.test(val)) strength = 2;
        if (/[^A-Za-z0-9]/.test(val) && val.length >= 8) strength = 3;
        
        pwdStrengthBar.className = 'strength-bar';
        if (val.length === 0) {
            pwdStrengthText.innerText = 'Password strength';
        } else if (strength === 1) {
            pwdStrengthBar.classList.add('weak');
            pwdStrengthText.innerText = 'Weak password';
        } else if (strength === 2) {
            pwdStrengthBar.classList.add('medium');
            pwdStrengthText.innerText = 'Medium password';
        } else {
            pwdStrengthBar.classList.add('strong');
            pwdStrengthText.innerText = 'Strong password';
        }
    });

    // Form inputs real-time validation remover
    document.querySelectorAll('.input-group input').forEach(input => {
        input.addEventListener('input', () => {
            input.parentElement.classList.remove('invalid');
        });
    });

    // API Helper: headers setup with auth token
    function getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        return headers;
    }

    // Sign Up form submission
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        let isValid = true;
        const nameVal = signupNameInput.value.trim();
        const emailVal = signupEmailInput.value.trim();
        const pwdVal = signupPwdInput.value;
        
        // Name
        if (!nameVal) {
            signupNameInput.parentElement.classList.add('invalid');
            isValid = false;
        }
        // Email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailVal)) {
            signupEmailInput.parentElement.classList.add('invalid');
            isValid = false;
        }
        // Password
        if (pwdVal.length < 6) {
            signupPwdInput.parentElement.classList.add('invalid');
            isValid = false;
        }
        // Terms
        if (!termsAgreeChk.checked) {
            showLuxuryToast("You must accept the Atelier service conditions", "error");
            isValid = false;
        }
        
        if (!isValid) return;

        try {
            const res = await fetch(`${API_BASE}/auth/signup`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ name: nameVal, email: emailVal, password: pwdVal })
            });
            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.message || 'Signup failed');
            }
            
            authToken = data.token;
            userProfile = data.user;
            localStorage.setItem('glowar_token', authToken);
            localStorage.setItem('glowar_user', JSON.stringify(userProfile));
            
            showLuxuryToast(`Welcome to the Atelier, ${userProfile.name}!`, 'success');
            transitionToDashboard();
            
            // Trigger dynamic syncs
            fetchProducts();
            fetchCart();
            fetchDiagnosticsHistory();
            fetchOrders();
        } catch (err) {
            console.error(err);
            showLuxuryToast(err.message, 'error');
        }
    });

    // Login Form Submit
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            let isValid = true;
            const emailVal = loginEmailInput.value.trim();
            const pwdVal = loginPwdInput.value;
            
            if (!emailVal) {
                loginEmailInput.parentElement.classList.add('invalid');
                isValid = false;
            }
            if (!pwdVal) {
                loginPwdInput.parentElement.classList.add('invalid');
                isValid = false;
            }
            
            if (!isValid) return;
            
            try {
                const res = await fetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({ email: emailVal, password: pwdVal })
                });
                const data = await res.json();
                
                if (!res.ok) {
                    throw new Error(data.message || 'Login credentials invalid');
                }
                
                authToken = data.token;
                userProfile = data.user;
                localStorage.setItem('glowar_token', authToken);
                localStorage.setItem('glowar_user', JSON.stringify(userProfile));
                
                showLuxuryToast(`Welcome back, ${userProfile.name}`, 'success');
                transitionToDashboard();
                
                // Load user data
                fetchProducts();
                fetchCart();
                fetchDiagnosticsHistory();
                fetchOrders();
            } catch (err) {
                console.error(err);
                showLuxuryToast(err.message, 'error');
            }
        });
    }

    function transitionToDashboard() {
        if (!userProfile) return;
        
        // Update user elements
        userNameLbl.innerText = userProfile.name;
        userAvatarLbl.innerText = userProfile.name.charAt(0).toUpperCase();
        
        if (drawerUserName) drawerUserName.innerText = userProfile.name;
        
        authScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        window.scrollTo(0, 0);
        
        // Reset canvas sizes
        setupCanvasDimensions();
        renderTryOn();
    }

    // Auto-check if logged in already (Session validation)
    async function checkActiveSession() {
        if (authToken) {
            try {
                const res = await fetch(`${API_BASE}/auth/me`, {
                    method: 'GET',
                    headers: getHeaders()
                });
                const data = await res.json();
                
                if (res.ok) {
                    userProfile = data.user;
                    localStorage.setItem('glowar_user', JSON.stringify(userProfile));
                    transitionToDashboard();
                    
                    fetchProducts();
                    fetchCart();
                    fetchDiagnosticsHistory();
                    fetchOrders();
                } else {
                    // Stale/expired token
                    logoutBtn.click();
                }
            } catch (err) {
                console.error("Session restore error", err);
                // Keep local user profile if server offline but log warning
                const storedUser = localStorage.getItem('glowar_user');
                if (storedUser) {
                    userProfile = JSON.parse(storedUser);
                    transitionToDashboard();
                }
            }
        }
    }
    
    // Trigger session checkout at load
    checkActiveSession();
    initSkinMLModel();

    // Logout trigger
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('glowar_token');
        localStorage.removeItem('glowar_user');
        authToken = null;
        userProfile = null;
        cartStorage = [];
        
        updateCartHUD();
        
        appScreen.classList.add('hidden');
        authScreen.classList.remove('hidden');
        
        signupForm.reset();
        if (loginForm) loginForm.reset();
        
        pwdStrengthBar.className = 'strength-bar';
        pwdStrengthText.innerText = 'Password strength';
        stopWebcam();
        showLuxuryToast('Signed out successfully.', 'info');
    });

    // Navigation scroll handling
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const targetElem = document.getElementById(targetId);
            
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            const headerOffset = targetId === 'skin-anchor' ? 140 : 100;
            const elementPosition = targetElem.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        });
    });

    // ==========================================================================
    // Camera Viewport Media Switching (Tabs)
    // ==========================================================================
    camTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            camTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const targetTab = tab.getAttribute('data-tab');
            tabPanels.forEach(p => p.classList.remove('active'));
            
            if (targetTab === 'preset') {
                presetsPanel.classList.add('active');
                stopWebcam();
            } else if (targetTab === 'upload') {
                uploadPanel.classList.add('active');
                stopWebcam();
            } else if (targetTab === 'camera') {
                cameraPanel.classList.add('active');
                startWebcam();
            }
        });
    });

    // Preset Selection click
    presetItems.forEach(item => {
        item.addEventListener('click', () => {
            presetItems.forEach(p => p.classList.remove('active'));
            item.classList.add('active');
            
            const index = parseInt(item.getAttribute('data-index'));
            activeLandmarks = JSON.parse(JSON.stringify(presetsLandmarks[index]));
            
            const imgUrl = item.getAttribute('data-img');
            loadNewBaseImage(imgUrl);
        });
    });

    function loadNewBaseImage(url) {
        currentImageElement = new Image();
        if (!url.startsWith('data:')) {
            currentImageElement.crossOrigin = 'anonymous';
        }
        currentImageElement.src = url;
        currentImageElement.onload = () => {
            setupCanvasDimensions();
            
            // Check if AI face detector is ready, otherwise load and run
            if (faceLandmarker) {
                runAutoFaceDetection(currentImageElement);
            } else {
                renderTryOn();
                if (isCalibrationMode) alignCalibrationNodes();
                initFaceDetector().then(() => {
                    if (faceLandmarker) runAutoFaceDetection(currentImageElement);
                });
            }
        };
    }

    // ==========================================================================
    // Webcam Controller
    // ==========================================================================
    function startWebcam() {
        cameraError.classList.add('hidden');
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } })
            .then(stream => {
                webcamStream = stream;
                webcamFeed.srcObject = stream;
                webcamFeed.onplay = () => {
                    const checkDims = setInterval(() => {
                        if (webcamFeed.videoWidth > 0) {
                            clearInterval(checkDims);
                            setupCanvasDimensions();
                            startLiveRenderLoop();
                            startLiveTracking();
                        }
                    }, 50);
                };
            })
            .catch(err => {
                console.error("Camera access error:", err);
                cameraError.classList.remove('hidden');
            });
    }

    function startLiveRenderLoop() {
        isLiveRendering = true;
        function tick() {
            if (!isLiveRendering || !webcamStream) return;
            renderTryOn();
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    function stopLiveRenderLoop() {
        isLiveRendering = false;
    }

    function startLiveTracking() {
        if (liveTrackingInterval) clearInterval(liveTrackingInterval);
        liveTrackingInterval = setInterval(async () => {
            if (!webcamStream || !faceLandmarker) return;
            try {
                const result = faceLandmarker.detect(webcamFeed);
                if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
                    const landmarks = result.faceLandmarks[0];
                    
                    // Coordinates mapping for face landmarks: mirrored layout
                    const outerLipUpperIndices = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291];
                    const outerLipLowerIndices = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291];
                    const innerLipUpperIndices = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
                    const innerLipLowerIndices = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308];
                    const eyesLidLeftIndices = [33, 246, 161, 160, 159, 158, 157, 173, 133];
                    const eyesLidRightIndices = [263, 466, 388, 387, 386, 385, 384, 398, 362];

                    activeLandmarks = {
                        leftEye: { 
                            x: 1 - ((landmarks[33].x + landmarks[133].x) / 2), 
                            y: (landmarks[33].y + landmarks[133].y) / 2 
                        },
                        rightEye: { 
                            x: 1 - ((landmarks[263].x + landmarks[362].x) / 2), 
                            y: (landmarks[263].y + landmarks[362].y) / 2 
                        },
                        leftCheek: { x: 1 - landmarks[234].x, y: landmarks[234].y },
                        rightCheek: { x: 1 - landmarks[454].x, y: landmarks[454].y },
                        lipLeft: { x: 1 - landmarks[61].x, y: landmarks[61].y },
                        lipRight: { x: 1 - landmarks[291].x, y: landmarks[291].y },
                        lipTop: { x: 1 - landmarks[13].x, y: landmarks[13].y },
                        lipBottom: { x: 1 - landmarks[14].x, y: landmarks[14].y },
                        lipsOuterUpper: outerLipUpperIndices.map(idx => ({ x: 1 - landmarks[idx].x, y: landmarks[idx].y })),
                        lipsOuterLower: outerLipLowerIndices.map(idx => ({ x: 1 - landmarks[idx].x, y: landmarks[idx].y })),
                        lipsInnerUpper: innerLipUpperIndices.map(idx => ({ x: 1 - landmarks[idx].x, y: landmarks[idx].y })),
                        lipsInnerLower: innerLipLowerIndices.map(idx => ({ x: 1 - landmarks[idx].x, y: landmarks[idx].y })),
                        leftEyeLid: eyesLidLeftIndices.map(idx => ({ x: 1 - landmarks[idx].x, y: landmarks[idx].y })),
                        rightEyeLid: eyesLidRightIndices.map(idx => ({ x: 1 - landmarks[idx].x, y: landmarks[idx].y }))
                    };
                    if (isCalibrationMode) alignCalibrationNodes();
                }
            } catch (err) {
                console.error("Live tracking error:", err);
            }
        }, 100);
    }

    function stopLiveTracking() {
        if (liveTrackingInterval) {
            clearInterval(liveTrackingInterval);
            liveTrackingInterval = null;
        }
    }

    function stopWebcam() {
        stopLiveTracking();
        stopLiveRenderLoop();
        if (webcamStream) {
            webcamStream.getTracks().forEach(track => track.stop());
            webcamStream = null;
        }
    }

    btnCapture.addEventListener('click', () => {
        if (!webcamStream) return;
        
        // Temporarily create video/canvas to pull frame
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = webcamFeed.videoWidth || 640;
        tempCanvas.height = webcamFeed.videoHeight || 480;
        
        const tempCtx = tempCanvas.getContext('2d');
        // Mirror snapshot to match screen layout
        tempCtx.translate(tempCanvas.width, 0);
        tempCtx.scale(-1, 1);
        tempCtx.drawImage(webcamFeed, 0, 0, tempCanvas.width, tempCanvas.height);
        
        const frameDataUrl = tempCanvas.toDataURL('image/jpeg');
        
        // Reset default markers centered in base scale
        activeLandmarks = {
            leftEye: { x: 0.40, y: 0.38 },
            rightEye: { x: 0.60, y: 0.38 },
            leftCheek: { x: 0.35, y: 0.55 },
            rightCheek: { x: 0.65, y: 0.55 },
            lipLeft: { x: 0.44, y: 0.68 },
            lipRight: { x: 0.56, y: 0.68 },
            lipTop: { x: 0.50, y: 0.65 },
            lipBottom: { x: 0.50, y: 0.72 }
        };
        
        // Switch back to preset viewer container
        loadNewBaseImage(frameDataUrl);
        
        // Move selection header back to Presets/Static display visual
        camTabs.forEach(t => t.classList.remove('active'));
        document.querySelector('[data-tab="preset"]').classList.add('active');
        tabPanels.forEach(p => p.classList.remove('active'));
        presetsPanel.classList.add('active');
        
        stopWebcam();
    });

    // ==========================================================================
    // File Drag/Drop Upload Controller
    // ==========================================================================
    uploadTriggerBtn.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
        handleUploadFile(e.target.files[0]);
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--primary)';
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'rgba(255,255,255,0.25)';
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'rgba(255,255,255,0.25)';
        handleUploadFile(e.dataTransfer.files[0]);
    });

    function handleUploadFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            alert('Please select a valid image file (PNG/JPG).');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
            activeLandmarks = {
                leftEye: { x: 0.40, y: 0.38 },
                rightEye: { x: 0.60, y: 0.38 },
                leftCheek: { x: 0.35, y: 0.55 },
                rightCheek: { x: 0.65, y: 0.55 },
                lipLeft: { x: 0.44, y: 0.68 },
                lipRight: { x: 0.56, y: 0.68 },
                lipTop: { x: 0.50, y: 0.65 },
                lipBottom: { x: 0.50, y: 0.72 }
            };
            loadNewBaseImage(event.target.result);
            
            // Switch tabs
            camTabs.forEach(t => t.classList.remove('active'));
            document.querySelector('[data-tab="preset"]').classList.add('active');
            tabPanels.forEach(p => p.classList.remove('active'));
            presetsPanel.classList.add('active');
        };
        reader.readAsDataURL(file);
    }

    // ==========================================================================
    // Real-Time Canvas AR Overlay rendering
    // ==========================================================================
    function renderTryOn() {
        ctx.clearRect(0, 0, arCanvas.width, arCanvas.height);
        
        // 1. Draw base photo or webcam feed
        if (webcamStream) {
            ctx.save();
            ctx.translate(arCanvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(webcamFeed, 0, 0, arCanvas.width, arCanvas.height);
            ctx.restore();
        } else {
            if (!currentImageElement.complete) return;
            ctx.drawImage(currentImageElement, 0, 0, arCanvas.width, arCanvas.height);
        }
        
        // 2. Draw makeup if enabled (Check division side split math)
        ctx.save();
        
        if (isCompareMode) {
            // Clip context to only render makeup on the right side of splitRatio divider
            ctx.beginPath();
            ctx.rect(arCanvas.width * splitRatio, 0, arCanvas.width * (1 - splitRatio), arCanvas.height);
            ctx.clip();
        }
        
        // Draw Makeup Filters
        applyEyeshadow();
        applyBlush();
        applyLips();
        
        ctx.restore();
    }

    function hexToRgba(hex, alpha = 1) {
        if (!hex || typeof hex !== 'string') return `rgba(255, 255, 255, ${alpha})`;
        let c = hex.substring(1);
        if (c.length === 3) {
            c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
        }
        const r = parseInt(c.substring(0, 2), 16) || 255;
        const g = parseInt(c.substring(2, 4), 16) || 255;
        const b = parseInt(c.substring(4, 6), 16) || 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function getLipContourPoints() {
        if (activeLandmarks.lipsOuterUpper && activeLandmarks.lipsOuterUpper.length > 0) {
            return {
                outerUpper: activeLandmarks.lipsOuterUpper.map(getCanvasCoordinate),
                outerLower: activeLandmarks.lipsOuterLower.map(getCanvasCoordinate),
                innerUpper: activeLandmarks.lipsInnerUpper.map(getCanvasCoordinate),
                innerLower: activeLandmarks.lipsInnerLower.map(getCanvasCoordinate)
            };
        }
        
        // Fallback: approximate using 4 keypoints
        const pL = getCanvasCoordinate(activeLandmarks.lipLeft);
        const pR = getCanvasCoordinate(activeLandmarks.lipRight);
        const pT = getCanvasCoordinate(activeLandmarks.lipTop);
        const pB = getCanvasCoordinate(activeLandmarks.lipBottom);
        
        // Approximate outer contours (Left to Right)
        const outerUpper = [pL];
        for (let i = 1; i < 5; i++) {
            outerUpper.push({
                x: pL.x + (pT.x - pL.x) * (i / 5),
                y: pL.y + (pT.y - pL.y) * (i / 5) - Math.sin((i / 5) * Math.PI) * 4
            });
        }
        outerUpper.push(pT);
        for (let i = 1; i < 5; i++) {
            outerUpper.push({
                x: pT.x + (pR.x - pT.x) * (i / 5),
                y: pT.y + (pR.y - pT.y) * (i / 5) - Math.sin((i / 5) * Math.PI) * 4
            });
        }
        outerUpper.push(pR);

        const outerLower = [pL];
        for (let i = 1; i < 5; i++) {
            outerLower.push({
                x: pL.x + (pB.x - pL.x) * (i / 5),
                y: pL.y + (pB.y - pL.y) * (i / 5) + Math.sin((i / 5) * Math.PI) * 6
            });
        }
        outerLower.push(pB);
        for (let i = 1; i < 5; i++) {
            outerLower.push({
                x: pB.x + (pR.x - pB.x) * (i / 5),
                y: pB.y + (pR.y - pB.y) * (i / 5) + Math.sin((i / 5) * Math.PI) * 6
            });
        }
        outerLower.push(pR);

        // Approximate inner contours (Left to Right)
        const midX = (pL.x + pR.x) / 2;
        const midY = (pL.y + pR.y) / 2;
        const innerUpperVal = { x: midX, y: midY - 2 };
        const innerLowerVal = { x: midX, y: midY + 2 };

        const innerUpper = [pL];
        for (let i = 1; i < 5; i++) {
            innerUpper.push({
                x: pL.x + (innerUpperVal.x - pL.x) * (i / 5),
                y: pL.y + (innerUpperVal.y - pL.y) * (i / 5)
            });
        }
        innerUpper.push(innerUpperVal);
        for (let i = 1; i < 5; i++) {
            innerUpper.push({
                x: innerUpperVal.x + (pR.x - innerUpperVal.x) * (i / 5),
                y: innerUpperVal.y + (pR.y - innerUpperVal.y) * (i / 5)
            });
        }
        innerUpper.push(pR);

        const innerLower = [pL];
        for (let i = 1; i < 5; i++) {
            innerLower.push({
                x: pL.x + (innerLowerVal.x - pL.x) * (i / 5),
                y: pL.y + (innerLowerVal.y - pL.y) * (i / 5)
            });
        }
        innerLower.push(innerLowerVal);
        for (let i = 1; i < 5; i++) {
            innerLower.push({
                x: innerLowerVal.x + (pR.x - innerLowerVal.x) * (i / 5),
                y: innerLowerVal.y + (pR.y - innerLowerVal.y) * (i / 5)
            });
        }
        innerLower.push(pR);

        return { outerUpper, outerLower, innerUpper, innerLower };
    }

    function getEyeLidContourPoints() {
        if (activeLandmarks.leftEyeLid && activeLandmarks.leftEyeLid.length > 0) {
            return {
                left: activeLandmarks.leftEyeLid.map(getCanvasCoordinate),
                right: activeLandmarks.rightEyeLid.map(getCanvasCoordinate)
            };
        }
        
        // Fallback: Generate mathematical curved eyelids from leftEye and rightEye nodes
        const pL = getCanvasCoordinate(activeLandmarks.leftEye);
        const pR = getCanvasCoordinate(activeLandmarks.rightEye);
        
        // Let's assume eye width is proportional to cheek spacing
        const faceWidth = Math.abs(activeLandmarks.rightCheek.x - activeLandmarks.leftCheek.x) * arCanvas.width;
        const eyeWidth = faceWidth * 0.12; // Proportional eye width
        
        // Generate Left Eye (screen left) eyelid contour from outer corner to inner corner
        const leftOuter = { x: pL.x - eyeWidth / 2, y: pL.y };
        const leftInner = { x: pL.x + eyeWidth / 2, y: pL.y };
        const left = [];
        for (let i = 0; i <= 8; i++) {
            const t = i / 8;
            const x = leftOuter.x + t * (leftInner.x - leftOuter.x);
            // Arch upwards using sine curve
            const y = pL.y - Math.sin(t * Math.PI) * (eyeWidth * 0.28);
            left.push({ x, y });
        }
        
        // Generate Right Eye (screen right) eyelid contour from outer corner to inner corner
        const rightOuter = { x: pR.x + eyeWidth / 2, y: pR.y };
        const rightInner = { x: pR.x - eyeWidth / 2, y: pR.y };
        const right = [];
        for (let i = 0; i <= 8; i++) {
            const t = i / 8;
            const x = rightOuter.x + t * (rightInner.x - rightOuter.x);
            // Arch upwards using sine curve
            const y = pR.y - Math.sin(t * Math.PI) * (eyeWidth * 0.28);
            right.push({ x, y });
        }
        
        return { left, right };
    }

    function applyLips() {
        const lips = makeupState.lips;
        const opacity = parseFloat(lips.opacity);
        if (opacity === 0) return;
        
        ctx.save();
        
        // 1. Get contours (AI high-fidelity or fallback curves)
        const contours = getLipContourPoints();
        const expand = parseFloat(lips.expand) || 0;
        
        // Extrapolate coordinates for center calculation
        const pL = getCanvasCoordinate(activeLandmarks.lipLeft);
        const pR = getCanvasCoordinate(activeLandmarks.lipRight);
        const pT = getCanvasCoordinate(activeLandmarks.lipTop);
        const pB = getCanvasCoordinate(activeLandmarks.lipBottom);
        const lipsCenterX = (pL.x + pR.x) / 2;
        const lipsCenterY = (pT.y + pB.y) / 2;
        
        // 2. Expand outer boundaries only (plumping/overlining lips)
        if (expand !== 0) {
            contours.outerUpper.forEach(pt => {
                if (pt.y < lipsCenterY) {
                    pt.y -= expand * 0.7;
                } else {
                    pt.y -= expand * 0.25;
                }
                if (pt.x < lipsCenterX) pt.x -= expand * 0.25;
                else pt.x += expand * 0.25;
            });
            
            contours.outerLower.forEach(pt => {
                if (pt.y > lipsCenterY) {
                    pt.y += expand * 0.7;
                } else {
                    pt.y += expand * 0.25;
                }
                if (pt.x < lipsCenterX) pt.x -= expand * 0.25;
                else pt.x += expand * 0.25;
            });
        }
        
        // 3. Draw Lip Pigment Layer
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = opacity;
        
        // UPPER LIP PATH (Trace Left-to-Right outer, then Right-to-Left inner in reverse)
        ctx.beginPath();
        ctx.moveTo(contours.outerUpper[0].x, contours.outerUpper[0].y);
        for (let i = 1; i < contours.outerUpper.length; i++) {
            ctx.lineTo(contours.outerUpper[i].x, contours.outerUpper[i].y);
        }
        ctx.lineTo(contours.innerUpper[contours.innerUpper.length - 1].x, contours.innerUpper[contours.innerUpper.length - 1].y);
        for (let i = contours.innerUpper.length - 2; i >= 0; i--) {
            ctx.lineTo(contours.innerUpper[i].x, contours.innerUpper[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = lips.color;
        ctx.fill();
        
        // LOWER LIP PATH (Trace Left-to-Right inner, then Right-to-Left outer in reverse)
        ctx.beginPath();
        ctx.moveTo(contours.innerLower[0].x, contours.innerLower[0].y);
        for (let i = 1; i < contours.innerLower.length; i++) {
            ctx.lineTo(contours.innerLower[i].x, contours.innerLower[i].y);
        }
        ctx.lineTo(contours.outerLower[contours.outerLower.length - 1].x, contours.outerLower[contours.outerLower.length - 1].y);
        for (let i = contours.outerLower.length - 2; i >= 0; i--) {
            ctx.lineTo(contours.outerLower[i].x, contours.outerLower[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = lips.color;
        ctx.fill();
        
        ctx.restore();
        
        // 4. Overlay Highlights for textures (Glossy / Metallic shimmer shine)
        if (lips.finish !== 'matte') {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = lips.finish === 'glossy' ? 0.35 : 0.25;
            
            // Draw specular reflection highlights matching new expanded dimensions
            const midOuterL = contours.outerLower[Math.floor(contours.outerLower.length / 2)];
            const midInnerL = contours.innerLower[Math.floor(contours.innerLower.length / 2)];
            const highlightX = (midOuterL.x + midInnerL.x) / 2;
            const highlightY = (midOuterL.y + midInnerL.y) / 2;
            
            ctx.beginPath();
            ctx.ellipse(highlightX, highlightY - 2, 15 + Math.abs(expand) * 0.25, 3 + Math.abs(expand) * 0.05, 0, 0, Math.PI * 2);
            ctx.closePath();
            
            const gradient = ctx.createRadialGradient(highlightX, highlightY - 2, 1, highlightX, highlightY - 2, 15 + Math.abs(expand) * 0.25);
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = gradient;
            ctx.fill();
            
            if (lips.finish === 'metallic') {
                // Add metallic gold specks centered on cupid's bow thickness
                const midOuterU = contours.outerUpper[Math.floor(contours.outerUpper.length / 2)];
                const midInnerU = contours.innerUpper[Math.floor(contours.innerUpper.length / 2)];
                const cupidX = (midOuterU.x + midInnerU.x) / 2;
                const cupidY = (midOuterU.y + midInnerU.y) / 2;
                
                ctx.beginPath();
                ctx.ellipse(cupidX, cupidY, 8 + Math.abs(expand) * 0.15, 2 + Math.abs(expand) * 0.05, 0, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 223, 0, 0.45)';
                ctx.fill();
            }
            
            ctx.restore();
        }
    }

    function applyBlush() {
        const cheeks = makeupState.cheeks;
        const opacity = parseFloat(cheeks.opacity);
        if (opacity === 0) return;
        
        const pL = getCanvasCoordinate(activeLandmarks.leftCheek);
        const pR = getCanvasCoordinate(activeLandmarks.rightCheek);
        
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = opacity;
        
        // Define blush spot radius relative to face width estimation and expand slider
        const faceWidth = Math.abs(pR.x - pL.x);
        const expand = parseFloat(cheeks.expand) || 35;
        const radius = (expand / 160) * faceWidth;
        
        // Left Cheek Blush
        let gradL = ctx.createRadialGradient(pL.x, pL.y, 2, pL.x, pL.y, radius);
        gradL.addColorStop(0, cheeks.color);
        gradL.addColorStop(1, hexToRgba(cheeks.color, 0));
        ctx.beginPath();
        ctx.arc(pL.x, pL.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradL;
        ctx.fill();
        
        // Right Cheek Blush
        let gradR = ctx.createRadialGradient(pR.x, pR.y, 2, pR.x, pR.y, radius);
        gradR.addColorStop(0, cheeks.color);
        gradR.addColorStop(1, hexToRgba(cheeks.color, 0));
        ctx.beginPath();
        ctx.arc(pR.x, pR.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradR;
        ctx.fill();
        
        ctx.restore();
    }

    function applyEyeshadow() {
        const eyes = makeupState.eyes;
        const opacity = parseFloat(eyes.opacity);
        if (opacity === 0) return;
        
        const pL = getCanvasCoordinate(activeLandmarks.leftEye);
        const pR = getCanvasCoordinate(activeLandmarks.rightEye);
        
        ctx.save();
        
        // Custom blending for light shimmering/frost colors vs dark matte colors
        let isLightColor = false;
        const hex = eyes.color;
        if (hex && hex.startsWith('#')) {
            let c = hex.substring(1);
            if (c.length === 3) {
                c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
            }
            const r = parseInt(c.substring(0, 2), 16);
            const g = parseInt(c.substring(2, 4), 16);
            const b = parseInt(c.substring(4, 6), 16);
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            if (luminance > 0.65) {
                isLightColor = true;
            }
        }

        if (isLightColor) {
            // Light shades look beautiful and glowy with source-over and soft alpha
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = opacity * 0.9; 
        } else {
            ctx.globalCompositeOperation = 'multiply';
            ctx.globalAlpha = opacity;
        }
        
        // Calculate shadow size relative to eye spacing and expand slider
        const eyeSpan = Math.abs(pR.x - pL.x);
        const expand = parseFloat(eyes.expand) || 25;
        const shadowSize = (expand / 120) * eyeSpan;
        
        // Dynamic blur radius to allow spread quality very well
        const blurRadius = shadowSize * 0.35;
        ctx.filter = `blur(${blurRadius}px)`;
        
        const contours = getEyeLidContourPoints();
        const lContour = contours.left;
        const rContour = contours.right;
        
        // 1. Left eye shadow path (Trace natural upper lid, then arch crease in reverse)
        ctx.beginPath();
        ctx.moveTo(lContour[0].x, lContour[0].y);
        for (let i = 1; i < lContour.length; i++) {
            ctx.lineTo(lContour[i].x, lContour[i].y);
        }
        for (let i = lContour.length - 1; i >= 0; i--) {
            const t = i / (lContour.length - 1);
            const archY = lContour[i].y - shadowSize * Math.sin(t * Math.PI);
            ctx.lineTo(lContour[i].x, archY);
        }
        ctx.closePath();
        
        const midIdxL = Math.floor(lContour.length / 2);
        const gradX_L = lContour[midIdxL].x;
        const gradY_L = lContour[midIdxL].y - shadowSize * 0.3;
        let gradL = ctx.createRadialGradient(gradX_L, gradY_L, shadowSize * 0.1, gradX_L, gradY_L, shadowSize * 1.25);
        gradL.addColorStop(0, eyes.color);
        gradL.addColorStop(0.5, hexToRgba(eyes.color, 0.75));
        gradL.addColorStop(1, hexToRgba(eyes.color, 0));
        ctx.fillStyle = gradL;
        ctx.fill();
        
        // 2. Right eye shadow path (Trace natural upper lid, then arch crease in reverse)
        ctx.beginPath();
        ctx.moveTo(rContour[0].x, rContour[0].y);
        for (let i = 1; i < rContour.length; i++) {
            ctx.lineTo(rContour[i].x, rContour[i].y);
        }
        for (let i = rContour.length - 1; i >= 0; i--) {
            const t = i / (rContour.length - 1);
            const archY = rContour[i].y - shadowSize * Math.sin(t * Math.PI);
            ctx.lineTo(rContour[i].x, archY);
        }
        ctx.closePath();
        
        const midIdxR = Math.floor(rContour.length / 2);
        const gradX_R = rContour[midIdxR].x;
        const gradY_R = rContour[midIdxR].y - shadowSize * 0.3;
        let gradR = ctx.createRadialGradient(gradX_R, gradY_R, shadowSize * 0.1, gradX_R, gradY_R, shadowSize * 1.25);
        gradR.addColorStop(0, eyes.color);
        gradR.addColorStop(0.5, hexToRgba(eyes.color, 0.75));
        gradR.addColorStop(1, hexToRgba(eyes.color, 0));
        ctx.fillStyle = gradR;
        ctx.fill();
        
        ctx.restore();
        
        // For light shimmer colors, overlay a subtle pearl luster sparkle
        if (isLightColor && opacity > 0.05) {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = opacity * 0.45;
            ctx.filter = `blur(${shadowSize * 0.2}px)`;
            
            ctx.beginPath();
            ctx.ellipse(gradX_L, lContour[midIdxL].y - shadowSize * 0.35, shadowSize * 0.8, shadowSize * 0.25, 0, 0, Math.PI * 2);
            ctx.ellipse(gradX_R, rContour[midIdxR].y - shadowSize * 0.35, shadowSize * 0.8, shadowSize * 0.25, 0, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            
            ctx.restore();
        }
    }

    function getCanvasCoordinate(landmark) {
        return {
            x: landmark.x * arCanvas.width,
            y: landmark.y * arCanvas.height
        };
    }

    // ==========================================================================
    // Draggable Calibration Markers Controller
    // ==========================================================================
    
    btnToggleCalibration.addEventListener('click', () => {
        isCalibrationMode = !isCalibrationMode;
        
        if (isCalibrationMode) {
             btnToggleCalibration.classList.add('active');
             calibrationOverlay.classList.remove('hidden');
             alignCalibrationNodes();
        } else {
             btnToggleCalibration.classList.remove('active');
             calibrationOverlay.classList.add('hidden');
             renderTryOn();
        }
    });

    function alignCalibrationNodes() {
        calNodes.forEach(node => {
            const id = node.id;
            let relativePt = null;
            
            if (id === 'node-l-eye') relativePt = activeLandmarks.leftEye;
            if (id === 'node-r-eye') relativePt = activeLandmarks.rightEye;
            if (id === 'node-l-cheek') relativePt = activeLandmarks.leftCheek;
            if (id === 'node-r-cheek') relativePt = activeLandmarks.rightCheek;
            
            if (id === 'node-l-lips') relativePt = activeLandmarks.lipLeft;
            if (id === 'node-r-lips') relativePt = activeLandmarks.lipRight;
            if (id === 'node-t-lips') relativePt = activeLandmarks.lipTop;
            if (id === 'node-b-lips') relativePt = activeLandmarks.lipBottom;
            
            if (relativePt) {
                // Map to screen display dimension coordinates
                const xPos = relativePt.x * arCanvas.offsetWidth;
                const yPos = relativePt.y * arCanvas.offsetHeight;
                
                node.style.left = `${xPos}px`;
                node.style.top = `${yPos}px`;
            }
        });
    }

    // Handles dragging of Calibration Nodes
    calNodes.forEach(node => {
        node.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isDraggingNode = node;
            node.classList.add('active');
        });
        node.addEventListener('touchstart', (e) => {
            isDraggingNode = node;
            node.classList.add('active');
        }, { passive: true });
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDraggingNode) return;
        handleDragMove(e.clientX, e.clientY);
    });

    document.addEventListener('touchmove', (e) => {
        if (!isDraggingNode) return;
        const touch = e.touches[0];
        handleDragMove(touch.clientX, touch.clientY);
    });

    function handleDragMove(clientX, clientY) {
        const rect = arCanvas.getBoundingClientRect();
        
        let screenX = clientX - rect.left;
        let screenY = clientY - rect.top;
        
        // Limits bounds
        if (screenX < 0) screenX = 0;
        if (screenX > rect.width) screenX = rect.width;
        if (screenY < 0) screenY = 0;
        if (screenY > rect.height) screenY = rect.height;
        
        // Update DOM node position
        isDraggingNode.style.left = `${screenX}px`;
        isDraggingNode.style.top = `${screenY}px`;
        
        // Map back to relative decimal mapping
        const relX = screenX / rect.width;
        const relY = screenY / rect.height;
        const nodeId = isDraggingNode.id;
        
        if (nodeId === 'node-l-eye') activeLandmarks.leftEye = { x: relX, y: relY };
        if (nodeId === 'node-r-eye') activeLandmarks.rightEye = { x: relX, y: relY };
        if (nodeId === 'node-l-cheek') activeLandmarks.leftCheek = { x: relX, y: relY };
        if (nodeId === 'node-r-cheek') activeLandmarks.rightCheek = { x: relX, y: relY };
        
        if (nodeId === 'node-l-lips') activeLandmarks.lipLeft = { x: relX, y: relY };
        if (nodeId === 'node-r-lips') activeLandmarks.lipRight = { x: relX, y: relY };
        if (nodeId === 'node-t-lips') activeLandmarks.lipTop = { x: relX, y: relY };
        if (nodeId === 'node-b-lips') activeLandmarks.lipBottom = { x: relX, y: relY };
        
        if (nodeId.includes('lips')) {
            delete activeLandmarks.lipsOuterUpper;
            delete activeLandmarks.lipsOuterLower;
            delete activeLandmarks.lipsInnerUpper;
            delete activeLandmarks.lipsInnerLower;
        }
        
        if (nodeId.includes('eye')) {
            delete activeLandmarks.leftEyeLid;
            delete activeLandmarks.rightEyeLid;
        }
        
        renderTryOn();
    }

    function clearDragging() {
        if (isDraggingNode) {
            isDraggingNode.classList.remove('active');
            isDraggingNode = null;
        }
    }
    document.addEventListener('mouseup', clearDragging);
    document.addEventListener('touchend', clearDragging);

    // ==========================================================================
    // Before / After Swipe Split Slider line
    // ==========================================================================
    btnToggleCompare.addEventListener('click', () => {
        isCompareMode = !isCompareMode;
        
        if (isCompareMode) {
             btnToggleCompare.classList.add('active');
             splitSliderLine.classList.remove('hidden');
        } else {
             btnToggleCompare.classList.remove('active');
             splitSliderLine.classList.add('hidden');
        }
        renderTryOn();
    });

    let isDraggingSlider = false;

    splitHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isDraggingSlider = true;
    });
    splitHandle.addEventListener('touchstart', () => {
        isDraggingSlider = true;
    }, { passive: true });

    document.addEventListener('mousemove', (e) => {
        if (!isDraggingSlider) return;
        handleSliderDrag(e.clientX);
    });
    document.addEventListener('touchmove', (e) => {
        if (!isDraggingSlider) return;
        const touch = e.touches[0];
        handleSliderDrag(touch.clientX);
    });

    function handleSliderDrag(clientX) {
        const rect = arCanvas.getBoundingClientRect();
        let relativeX = clientX - rect.left;
        
        if (relativeX < 0) relativeX = 0;
        if (relativeX > rect.width) relativeX = rect.width;
        
        const pct = relativeX / rect.width;
        splitRatio = pct;
        
        splitSliderLine.style.left = `${pct * 100}%`;
        renderTryOn();
    }

    document.addEventListener('mouseup', () => isDraggingSlider = false);
    document.addEventListener('touchend', () => isDraggingSlider = false);

    // Reset cosmetics filter actions
    btnResetFilters.addEventListener('click', () => {
        makeupState.lips.opacity = 0;
        makeupState.cheeks.opacity = 0;
        makeupState.eyes.opacity = 0;
        makeupState.lips.expand = 0;
        makeupState.cheeks.expand = 35;
        makeupState.eyes.expand = 25;
        
        lipsOpacityRange.value = 0;
        lipsOpacityGauge.innerText = '0%';
        cheeksOpacityRange.value = 0;
        cheeksOpacityGauge.innerText = '0%';
        eyesOpacityRange.value = 0;
        eyesOpacityGauge.innerText = '0%';
        
        if (lipsExpandRange) {
            lipsExpandRange.value = 0;
            lipsExpandGauge.innerText = '0px';
        }
        if (cheeksExpandRange) {
            cheeksExpandRange.value = 35;
            cheeksExpandGauge.innerText = '35px';
        }
        if (eyesExpandRange) {
            eyesExpandRange.value = 25;
            eyesExpandGauge.innerText = '25px';
        }
        
        renderTryOn();
        updateFormulaCard();
    });

    // ==========================================================================
    // Side panel controllers (Adjust tabs & Makeup customizer)
    // ==========================================================================
    
    // Switch Category Tabs
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            categoryBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const cat = btn.getAttribute('data-cat');
            catPanels.forEach(p => p.classList.remove('active'));
            document.getElementById(`cat-${cat}-panel`).classList.add('active');
        });
    });

    // Handle color select palettes
    setupColorPicker(lipsPalette, lipsShadeLbl, 'lips');
    setupColorPicker(cheeksPalette, cheeksShadeLbl, 'cheeks');
    setupColorPicker(eyesPalette, eyesShadeLbl, 'eyes');
    
    function setupColorPicker(paletteElem, labelElem, category) {
        const dots = paletteElem.querySelectorAll('.color-dot');
        dots.forEach(dot => {
            dot.addEventListener('click', () => {
                dots.forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
                
                const hexVal = dot.getAttribute('data-color');
                const nameVal = dot.getAttribute('data-name');
                
                makeupState[category].color = hexVal;
                makeupState[category].name = nameVal;
                labelElem.innerText = `Shade: ${nameVal}`;
                
                // If opacity is 0 or extremely low, automatically boost it so they see it!
                if (makeupState[category].opacity < 0.1) {
                    const defaultOpacity = category === 'lips' ? 0.7 : (category === 'cheeks' ? 0.4 : 0.45);
                    makeupState[category].opacity = defaultOpacity;
                    if (category === 'lips') {
                        lipsOpacityRange.value = defaultOpacity * 100;
                        lipsOpacityGauge.innerText = `${defaultOpacity * 100}%`;
                    } else if (category === 'cheeks') {
                        cheeksOpacityRange.value = defaultOpacity * 100;
                        cheeksOpacityGauge.innerText = `${defaultOpacity * 100}%`;
                    } else if (category === 'eyes') {
                        eyesOpacityRange.value = defaultOpacity * 100;
                        eyesOpacityGauge.innerText = `${defaultOpacity * 100}%`;
                    }
                }
                
                renderTryOn();
                updateFormulaCard();
            });
        });
    }

    // Handles lips finish type buttons
    const finishBtns = lipsFinishGroup.querySelectorAll('.finish-btn');
    finishBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            finishBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            makeupState.lips.finish = btn.getAttribute('data-finish');
            renderTryOn();
            updateFormulaCard();
        });
    });

    // Opacity Sliders listeners
    lipsOpacityRange.addEventListener('input', (e) => {
        let opacityVal = e.target.value;
        lipsOpacityGauge.innerText = `${opacityVal}%`;
        makeupState.lips.opacity = opacityVal / 100;
        renderTryOn();
    });
    
    lipsExpandRange.addEventListener('input', (e) => {
        let expandVal = parseInt(e.target.value);
        lipsExpandGauge.innerText = `${expandVal}px`;
        makeupState.lips.expand = expandVal;
        renderTryOn();
    });
    
    cheeksOpacityRange.addEventListener('input', (e) => {
        let opacityVal = e.target.value;
        cheeksOpacityGauge.innerText = `${opacityVal}%`;
        makeupState.cheeks.opacity = opacityVal / 100;
        renderTryOn();
    });
    
    if (cheeksExpandRange) {
        cheeksExpandRange.addEventListener('input', (e) => {
            let expandVal = parseInt(e.target.value);
            cheeksExpandGauge.innerText = `${expandVal}px`;
            makeupState.cheeks.expand = expandVal;
            renderTryOn();
        });
    }
    
    eyesOpacityRange.addEventListener('input', (e) => {
        let opacityVal = e.target.value;
        eyesOpacityGauge.innerText = `${opacityVal}%`;
        makeupState.eyes.opacity = opacityVal / 100;
        renderTryOn();
    });
    
    if (eyesExpandRange) {
        eyesExpandRange.addEventListener('input', (e) => {
            let expandVal = parseInt(e.target.value);
            eyesExpandGauge.innerText = `${expandVal}px`;
            makeupState.eyes.expand = expandVal;
            renderTryOn();
        });
    }

    function updateFormulaCard() {
        // Compute price sum mock
        let lipsActive = parseFloat(lipsOpacityRange.value) > 0;
        let cheeksActive = parseFloat(cheeksOpacityRange.value) > 0;
        let eyesActive = parseFloat(eyesOpacityRange.value) > 0;
        
        let activeFormulaName = "Custom Combination";
        let activeFormulaDescription = "Dermatologist-formulated clean cosmetics blended dynamically";
        let cost = 0;
        
        if (lipsActive) { cost += 34; activeFormulaName = `${makeupState.lips.name} Lip`; }
        if (cheeksActive) { cost += 28; activeFormulaName = `${makeupState.cheeks.name} Cheek`; }
        if (eyesActive) { cost += 32; activeFormulaName = `${makeupState.eyes.name} Shadow`; }
        
        if (lipsActive && cheeksActive && eyesActive) {
            activeFormulaName = "Imperial Radiant Look";
            activeFormulaDescription = `Featuring ${makeupState.lips.name} matte lipstick, a soft dust of ${makeupState.cheeks.name} cheeks and ${makeupState.eyes.name} lids.`;
            cost = 84; // discount combo bundle
        } else if (lipsActive && cheeksActive) {
            activeFormulaName = "Atelier Satin Duo";
            activeFormulaDescription = `Pairing ${makeupState.lips.name} lip cover with soft blends of ${makeupState.cheeks.name} blush.`;
            cost = 56;
        }
        
        if (cost === 0) { cost = 62; activeFormulaName = "Atelier Collection"; }
        
        activeFormulaTitle.innerText = activeFormulaName;
        activeFormulaDesc.innerText = activeFormulaDescription;
        activeFormulaPrice.innerText = `$${cost.toFixed(2)}`;
    }

    // ==========================================================================
    // Try On Trigger via Custom Product Catalog clicking
    // ==========================================================================
    document.querySelectorAll('.store-product-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.add-to-cart-btn')) return;
            
            const category = card.getAttribute('data-cat');
            const color = card.getAttribute('data-color');
            const opacity = parseFloat(card.getAttribute('data-opacity')) / 100;
            const finish = card.getAttribute('data-finish') || 'matte';
            
            // Switch customizable tabs
            categoryBtns.forEach(b => b.classList.remove('active'));
            const activeBtn = document.querySelector(`.cat-btn[data-cat="${category}"]`);
            if (activeBtn) activeBtn.classList.add('active');
            
            catPanels.forEach(p => p.classList.remove('active'));
            const activePanel = document.getElementById(`cat-${category}-panel`);
            if (activePanel) activePanel.classList.add('active');
            
            // Apply coordinates states
            makeupState[category].color = color;
            makeupState[category].opacity = opacity;
            if (category === 'lips') makeupState.lips.finish = finish;
            
            // Align sliders
            if (category === 'lips') {
                lipsOpacityRange.value = opacity * 100;
                lipsOpacityGauge.innerText = `${opacity * 100}%`;
                // Map color active dot
                updateActiveDot(lipsPalette, colorNameFromHex(color, 'lips'));
                lipsShadeLbl.innerText = `Shade: ${colorNameFromHex(color, 'lips')}`;
            } else if (category === 'cheeks') {
                cheeksOpacityRange.value = opacity * 100;
                cheeksOpacityGauge.innerText = `${opacity * 100}%`;
                if (cheeksExpandRange) {
                    const dbExpand = parseInt(card.getAttribute('data-expand')) || 35;
                    cheeksExpandRange.value = dbExpand;
                    cheeksExpandGauge.innerText = `${dbExpand}px`;
                    makeupState.cheeks.expand = dbExpand;
                }
                updateActiveDot(cheeksPalette, colorNameFromHex(color, 'cheeks'));
                cheeksShadeLbl.innerText = `Shade: ${colorNameFromHex(color, 'cheeks')}`;
            } else if (category === 'eyes') {
                eyesOpacityRange.value = opacity * 100;
                eyesOpacityGauge.innerText = `${opacity * 100}%`;
                if (eyesExpandRange) {
                    const dbExpand = parseInt(card.getAttribute('data-expand')) || 25;
                    eyesExpandRange.value = dbExpand;
                    eyesExpandGauge.innerText = `${dbExpand}px`;
                    makeupState.eyes.expand = dbExpand;
                }
                updateActiveDot(eyesPalette, colorNameFromHex(color, 'eyes'));
                eyesShadeLbl.innerText = `Shade: ${colorNameFromHex(color, 'eyes')}`;
            }
            
            // Scroll to viewer viewport
            document.getElementById('tryon-anchor').scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            renderTryOn();
            updateFormulaCard();
        });
    });

    function updateActiveDot(palette, shadeName) {
        const dots = palette.querySelectorAll('.color-dot');
        dots.forEach(d => {
            if (d.getAttribute('data-name') === shadeName || d.getAttribute('data-color') === shadeName) {
                dots.forEach(el => el.classList.remove('active'));
                d.classList.add('active');
            }
        });
    }

    function colorNameFromHex(hex, category) {
        const docDot = document.querySelector(`.color-dot[data-color="${hex}"]`);
        if (docDot && docDot.getAttribute('data-name')) {
            return docDot.getAttribute('data-name');
        }
        
        const fallbackNames = {
            '#e63946': 'Crimson Satin',
            '#560bad': 'Mulberry Wine',
            '#ff87ab': 'Soft Tulip',
            '#ffb703': 'Gold Dust',
            '#d90429': 'Velvet Muse',
            '#ff5400': 'Sunset Kiss',
            '#dda15e': 'Desert Sun',
            '#8338ec': 'Cosmopolitan Lavender',
            '#ff758f': 'Blush Nude',
            '#c9184a': 'Petal Coral',
            '#f08080': 'Warm Coral',
            '#cdb4db': 'Lavender Mist',
            '#fb5607': 'Copper Clay',
            '#3d348b': 'Deep Smudge',
            '#faf9f6': 'Pearl Shimmer',
            '#f5ebdc': 'Champagne Frost',
            '#fcd5ce': 'Rose Quartz',
            '#e8e0ff': 'Lilac Haze',
            '#d8f3dc': 'Mint Glaze'
        };

        return fallbackNames[hex] || hex;
    }

    // ==========================================================================
    // Dynamic Catalog, Cart Synchronization, and orders checkout APIs
    // ==========================================================================
    
    // Fetch and draw products catalog dynamically
    async function fetchProducts() {
        try {
            const res = await fetch(`${API_BASE}/products`);
            if (res.ok) {
                const products = await res.json();
                renderCatalogGrid(products);
            }
        } catch (err) {
            console.error("Failed to load catalog products from API", err);
            // Fallback to static catalog already in HTML
        }
    }

    function renderCatalogGrid(products) {
        if (!catalogProductsGrid) return;
        catalogProductsGrid.innerHTML = '';
        
        products.forEach(p => {
            const card = document.createElement('div');
            card.className = 'store-product-card';
            card.setAttribute('data-cat', p.category);
            card.setAttribute('data-color', p.shade_color);
            card.setAttribute('data-opacity', p.opacity_pct);
            card.setAttribute('data-finish', p.finish || 'matte');
            
            const badgeHTML = p.is_bestseller ? '<span class="prod-badge">BESTSELLER</span>' : '';
            
            let visualHTML = '';
            if (p.category === 'lips') {
                visualHTML = `<div class="makeup-product-stick lipstick" style="background: linear-gradient(135deg, ${p.shade_color} 0%, #000 100%)"></div>`;
            } else {
                visualHTML = `<div class="makeup-product-powder ${p.category === 'cheeks' ? 'blush' : 'eyeshadow'}" style="background: radial-gradient(circle, ${p.shade_color} 0%, rgba(0,0,0,0.6) 100%)"></div>`;
            }
            
            card.innerHTML = `
                <div class="product-img-holder">
                    ${badgeHTML}
                    ${visualHTML}
                </div>
                <div class="prod-details">
                    <span class="prod-category">${p.category.toUpperCase()}</span>
                    <h3>${p.name}</h3>
                    <p class="prod-desc">${p.description}</p>
                    <div class="prod-footer">
                        <span class="prod-price">$${Number(p.price).toFixed(2)}</span>
                        <div class="prod-actions">
                            <button class="btn btn-secondary btn-icon-lbl try-on-product-btn" title="Try on face model"><i class="fa-solid fa-camera"></i> Try On</button>
                            <button class="btn btn-primary btn-icon add-to-cart-btn" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}" title="Add to Bag"><i class="fa-solid fa-cart-plus"></i></button>
                        </div>
                    </div>
                </div>
            `;
            
            catalogProductsGrid.appendChild(card);
        });

        // Re-bind Try On buttons since grid is rebuilt
        catalogProductsGrid.querySelectorAll('.store-product-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.add-to-cart-btn')) return;
                
                const category = card.getAttribute('data-cat');
                const color = card.getAttribute('data-color');
                const opacity = parseFloat(card.getAttribute('data-opacity')) / 100;
                const finish = card.getAttribute('data-finish') || 'matte';
                
                categoryBtns.forEach(b => b.classList.remove('active'));
                const activeBtn = document.querySelector(`.cat-btn[data-cat="${category}"]`);
                if (activeBtn) activeBtn.classList.add('active');
                
                catPanels.forEach(p => p.classList.remove('active'));
                const activePanel = document.getElementById(`cat-${category}-panel`);
                if (activePanel) activePanel.classList.add('active');
                
                makeupState[category].color = color;
                makeupState[category].opacity = opacity;
                if (category === 'lips') makeupState.lips.finish = finish;
                
                if (category === 'lips') {
                    lipsOpacityRange.value = opacity * 100;
                    lipsOpacityGauge.innerText = `${opacity * 100}%`;
                    updateActiveDot(lipsPalette, colorNameFromHex(color, 'lips'));
                    lipsShadeLbl.innerText = `Shade: ${colorNameFromHex(color, 'lips')}`;
                } else if (category === 'cheeks') {
                    cheeksOpacityRange.value = opacity * 100;
                    cheeksOpacityGauge.innerText = `${opacity * 100}%`;
                    if (cheeksExpandRange) {
                        const dbExpand = parseInt(card.getAttribute('data-expand')) || 35;
                        cheeksExpandRange.value = dbExpand;
                        cheeksExpandGauge.innerText = `${dbExpand}px`;
                        makeupState.cheeks.expand = dbExpand;
                    }
                    updateActiveDot(cheeksPalette, colorNameFromHex(color, 'cheeks'));
                    cheeksShadeLbl.innerText = `Shade: ${colorNameFromHex(color, 'cheeks')}`;
                } else if (category === 'eyes') {
                    eyesOpacityRange.value = opacity * 100;
                    eyesOpacityGauge.innerText = `${opacity * 100}%`;
                    if (eyesExpandRange) {
                        const dbExpand = parseInt(card.getAttribute('data-expand')) || 25;
                        eyesExpandRange.value = dbExpand;
                        eyesExpandGauge.innerText = `${dbExpand}px`;
                        makeupState.eyes.expand = dbExpand;
                    }
                    updateActiveDot(eyesPalette, colorNameFromHex(color, 'eyes'));
                    eyesShadeLbl.innerText = `Shade: ${colorNameFromHex(color, 'eyes')}`;
                }
                
                document.getElementById('tryon-anchor').scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                renderTryOn();
                updateFormulaCard();
            });
        });

        // Re-bind Add To Bag buttons
        catalogProductsGrid.querySelectorAll('.add-to-cart-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const name = btn.getAttribute('data-name');
                const price = parseFloat(btn.getAttribute('data-price'));
                addToBag(id, name, price);
            });
        });
    }

    // Load Cart from api
    async function fetchCart() {
        if (!authToken) return;
        try {
            const res = await fetch(`${API_BASE}/cart`, {
                headers: getHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                cartStorage = data.cart || [];
                updateCartHUD();
            }
        } catch (err) {
            console.error("Cart sync load error", err);
        }
    }

    // Sync current active Cart state to server
    async function syncCartToServer() {
        if (!authToken) return;
        try {
            await fetch(`${API_BASE}/cart`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ items: cartStorage })
            });
        } catch (err) {
            console.error("Cart submit save error", err);
        }
    }

    // Add catalog item click defaults
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const name = btn.getAttribute('data-name');
            const price = parseFloat(btn.getAttribute('data-price'));
            addToBag(id, name, price);
        });
    });



    // Add composite combo
    addComboBtn.addEventListener('click', () => {
        const comboName = activeFormulaTitle.innerText;
        const comboPrice = parseFloat(activeFormulaPrice.innerText.substring(1));
        addToBag(Date.now().toString(), comboName, comboPrice);
    });

    async function addToBag(id, name, price) {
        cartStorage.push({ id, name, price });
        updateCartHUD();
        
        await syncCartToServer();
        showLuxuryToast(`${name} added to your shopping bag.`);
        
        // Bounce animation
        cartBtn.style.animation = 'none';
        setTimeout(() => { cartBtn.style.animation = 'pop 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)'; }, 10);
    }
    
    // Popup scaling
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        @keyframes pop {
            0% { transform: scale(1); }
            50% { transform: scale(1.3); color: var(--primary); }
            100% { transform: scale(1); }
        }
    `;
    document.head.appendChild(styleSheet);

    function updateCartHUD() {
        cartCountLbl.innerText = cartStorage.length;
        cartDropdownCount.innerText = cartStorage.length;
        
        if (cartStorage.length === 0) {
            cartItemsList.innerHTML = '<div class="cart-empty-text">Your bag is empty.</div>';
            cartSubtotalVal.innerText = '$0.00';
            return;
        }
        
        cartItemsList.innerHTML = '';
        let sum = 0;
        
        cartStorage.forEach((item, index) => {
            sum += Number(item.price);
            
            const row = document.createElement('div');
            row.className = 'cart-item-row';
            row.innerHTML = `
                <div class="cart-item-info">
                    <span class="cart-item-name">${item.name}</span>
                    <span class="cart-item-price">$${Number(item.price).toFixed(2)}</span>
                </div>
                <button class="cart-item-remove" data-index="${index}"><i class="fa-solid fa-trash-can"></i></button>
            `;
            cartItemsList.appendChild(row);
        });
        
        cartSubtotalVal.innerText = `$${sum.toFixed(2)}`;
        
        // Remove item buttons
        cartItemsList.querySelectorAll('.cart-item-remove').forEach(rmBtn => {
            rmBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const index = parseInt(rmBtn.getAttribute('data-index'));
                const removedName = cartStorage[index].name;
                cartStorage.splice(index, 1);
                updateCartHUD();
                
                await syncCartToServer();
                showLuxuryToast(`${removedName} removed from bag.`, 'info');
            });
        });
    }

    // Toggle dropdown manually
    cartBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        cartDropdown.classList.toggle('active');
    });
    
    document.addEventListener('click', () => {
        cartDropdown.classList.remove('active');
    });
    
    cartDropdown.addEventListener('click', (e) => e.stopPropagation());

    // ==========================================================================
    // Checkout Flow API Integration
    // ==========================================================================
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', async () => {
            if (cartStorage.length === 0) {
                showLuxuryToast("Your shopping bag is empty", "error");
                return;
            }
            
            let sum = 0;
            cartStorage.forEach(item => { sum += Number(item.price); });
            
            try {
                const res = await fetch(`${API_BASE}/orders`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({ items: cartStorage, subtotal: sum })
                });
                const data = await res.json();
                
                if (!res.ok) {
                    throw new Error(data.message || 'Checkout failed');
                }
                
                // Clear cart locally
                const oldCartCount = cartStorage.length;
                cartStorage = [];
                updateCartHUD();
                await syncCartToServer();
                
                // Show modal
                invoiceTxnId.innerText = data.transactionId;
                invoiceEmail.innerText = userProfile ? userProfile.email : 'guest@glowar.com';
                invoiceTotal.innerText = `$${sum.toFixed(2)}`;
                
                invoiceProductsList.innerHTML = '';
                data.items.forEach(itm => {
                    const row = document.createElement('div');
                    row.className = 'modal-prod-item';
                    row.innerHTML = `<span>${itm.name}</span><strong>$${Number(itm.price).toFixed(2)}</strong>`;
                    invoiceProductsList.appendChild(row);
                });
                
                checkoutModal.classList.remove('hidden');
                
                // Refresh list
                fetchOrders();
                showLuxuryToast(`Checked out ${oldCartCount} items successfully!`, 'success');
            } catch (err) {
                console.error(err);
                showLuxuryToast(err.message, 'error');
            }
        });
    }

    if (closeCheckoutModal) {
        closeCheckoutModal.addEventListener('click', () => checkoutModal.classList.add('hidden'));
    }
    if (btnModalDone) {
        btnModalDone.addEventListener('click', () => checkoutModal.classList.add('hidden'));
    }

    // Fetch and Draw Order Invoice Records
    async function fetchOrders() {
        if (!authToken) return;
        try {
            const res = await fetch(`${API_BASE}/orders`, {
                headers: getHeaders()
            });
            if (res.ok) {
                const orders = await res.json();
                renderOrdersList(orders);
            }
        } catch (err) {
            console.error("Failed to load user orders", err);
        }
    }

    function renderOrdersList(orders) {
        if (!orderHistoryList) return;
        if (orders.length === 0) {
            orderHistoryList.innerHTML = '<p class="order-empty-text">No past orders found. Fill your shopping bag and execute checking out to verify.</p>';
            return;
        }
        
        orderHistoryList.innerHTML = '';
        orders.forEach(o => {
            const card = document.createElement('div');
            card.className = 'order-receipt-card';
            
            let dateVal = o.created_at;
            if (typeof dateVal === 'string' && !dateVal.includes('T')) {
                dateVal = dateVal.replace(' ', 'T') + 'Z';
            }
            const dateStr = new Date(dateVal).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            
            const items = o.items;
            let itemsHTML = '';
            items.forEach(itm => {
                itemsHTML += `
                    <div class="receipt-prod-row">
                        <span>${itm.name}</span>
                        <strong>$${Number(itm.price).toFixed(2)}</strong>
                    </div>
                `;
            });
            
            card.innerHTML = `
                <div class="receipt-header">
                    <div class="receipt-meta">
                        <span>Invoice: <strong>${o.id}</strong></span>
                        <span>Date: <strong>${dateStr}</strong></span>
                    </div>
                    <div class="receipt-total">Total Paid: $${Number(o.subtotal).toFixed(2)}</div>
                </div>
                <div class="receipt-products">
                    ${itemsHTML}
                </div>
            `;
            orderHistoryList.appendChild(card);
        });
    }

    // ==========================================================================
    // ML Skin Diagnostics Model Initialization & Training
    // ==========================================================================
    async function initSkinMLModel() {
        if (typeof tf === 'undefined') {
            console.warn("TensorFlow.js is not loaded. ML diagnostics fall back to mathematical heuristics.");
            return;
        }
        try {
            console.log("GLOW AR: Compiling client-side Skin Dermal AI regression model...");
            
            // Create a small sequential neural net
            skinMLModel = tf.sequential();
            
            // Layer 1: Input layer (8 features) to hidden layer (12 units)
            skinMLModel.add(tf.layers.dense({
                units: 12,
                activation: 'relu',
                inputShape: [8],
                kernelInitializer: 'glorotNormal'
            }));
            
            // Layer 2: Hidden layer (12 units) to output layer (4 outputs: hydration, uniformity, redness, spots)
            // Outputs are range [0, 1] representing percentages, so sigmoid activation is mathematically robust.
            skinMLModel.add(tf.layers.dense({
                units: 4,
                activation: 'sigmoid',
                kernelInitializer: 'glorotNormal'
            }));
            
            // Compile using Adam optimizer and MSE loss
            skinMLModel.compile({
                optimizer: tf.train.adam(0.01),
                loss: 'meanSquaredError'
            });
            
            // Train model on baseline skin profile inputs representing standard dermal categories
            await trainModelOnSyntheticData();
            console.log("GLOW AR: Skin Dermal AI neural network initialized and calibrated successfully.");
        } catch (e) {
            console.error("Failed to initialize TFJS skin model:", e);
        }
    }

    async function trainModelOnSyntheticData() {
        if (!skinMLModel) return;
        
        // Synthetic training dataset (10 skin condition archetypes)
        // Feature columns: [MeanR, MeanG, MeanB, NormStd, EyeRatio, RedRatio, NormL, Symm]
        const trainInputs = tf.tensor2d([
            [0.85, 0.72, 0.65, 0.10, 0.96, 1.18, 0.74, 1.00], // Healthy/Normal skin
            [0.72, 0.58, 0.52, 0.35, 0.85, 1.24, 0.60, 0.98], // Dry, moderate redness & spots
            [0.90, 0.82, 0.78, 0.08, 0.98, 1.10, 0.83, 1.02], // Hydrated, clear skin
            [0.65, 0.50, 0.45, 0.45, 0.78, 1.30, 0.52, 0.95], // Dark spots, high redness, uneven
            [0.80, 0.68, 0.62, 0.20, 0.92, 1.17, 0.70, 0.99], // Balanced normal
            [0.75, 0.60, 0.55, 0.30, 0.90, 1.25, 0.63, 1.01], // Slightly dry/sensitive
            [0.88, 0.76, 0.70, 0.12, 0.95, 1.16, 0.78, 1.00], // Clear, very bright
            [0.70, 0.55, 0.48, 0.40, 0.80, 1.27, 0.57, 0.97], // Uneven skin tone, sensitivity
            [0.92, 0.84, 0.80, 0.06, 0.99, 1.09, 0.85, 1.01], // Perfect skin complexion
            [0.62, 0.48, 0.42, 0.48, 0.75, 1.29, 0.50, 0.94]  // Sub-optimal skin health
        ]);
        
        // Output labels: [Hydration, Uniformity, Redness, spots (dark circles)]
        const trainOutputs = tf.tensor2d([
            [0.85, 0.90, 0.15, 0.12], // Healthy
            [0.60, 0.65, 0.35, 0.40], // Dry / red / spots
            [0.95, 0.96, 0.08, 0.05], // Well-hydrated
            [0.45, 0.50, 0.60, 0.65], // High spots & redness
            [0.78, 0.82, 0.20, 0.18], // Balanced
            [0.68, 0.70, 0.30, 0.32], // Dry
            [0.89, 0.91, 0.12, 0.10], // Bright
            [0.55, 0.58, 0.45, 0.48], // Sensitive / uneven
            [0.97, 0.98, 0.05, 0.04], // Perfect
            [0.40, 0.45, 0.65, 0.70]  // Sub-optimal
        ]);
        
        // Fit model silently for 100 epochs
        await skinMLModel.fit(trainInputs, trainOutputs, {
            epochs: 100,
            shuffle: true,
            verbose: 0
        });
        
        // Dispose training tensors to prevent GPU/system memory leaks
        trainInputs.dispose();
        trainOutputs.dispose();
    }

    // ==========================================================================
    // AI Skin Diagnostics Scanner simulation & API Save
    // ==========================================================================
    btnScanSkin.addEventListener('click', () => {
        scannerLayer.classList.remove('hidden');
        document.getElementById('tryon-anchor').scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        setTimeout(() => {
            scannerLayer.classList.add('hidden');
            triggerDiagnosticResults();
        }, 3000);
    });

    function analyzeSkinReal() {
        // Fallback defaults
        let hydration = Math.floor(Math.random() * 20) + 70; // 70-90%
        let uniformity = Math.floor(Math.random() * 15) + 78; // 78-93%
        let redness = Math.floor(Math.random() * 10) + 10; // 10-20%
        let spots = Math.floor(Math.random() * 10) + 12; // 12-22%
        
        if (!activeLandmarks || !activeLandmarks.leftCheek || !activeLandmarks.leftEye) {
            console.warn("Real landmarks not available for analysis. Using calibrated defaults.");
            return { hydration, uniformity, redness, spots };
        }
        
        try {
            // Create a temporary canvas matching the AR canvas dimensions
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = arCanvas.width;
            tempCanvas.height = arCanvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Draw clean face image (without overlays)
            if (webcamStream) {
                tempCtx.save();
                tempCtx.translate(tempCanvas.width, 0);
                tempCtx.scale(-1, 1);
                tempCtx.drawImage(webcamFeed, 0, 0, tempCanvas.width, tempCanvas.height);
                tempCtx.restore();
            } else {
                if (currentImageElement && currentImageElement.complete) {
                    tempCtx.drawImage(currentImageElement, 0, 0, tempCanvas.width, tempCanvas.height);
                } else {
                    return { hydration, uniformity, redness, spots };
                }
            }
            
            // Helper to get average RGB and standard deviation of color in a box
            function getRegionMetrics(normX, normY, widthPx, heightPx) {
                const x = Math.round(normX * tempCanvas.width - widthPx / 2);
                const y = Math.round(normY * tempCanvas.height - heightPx / 2);
                
                const startX = Math.max(0, Math.min(tempCanvas.width - 1, x));
                const startY = Math.max(0, Math.min(tempCanvas.height - 1, y));
                const w = Math.max(1, Math.min(tempCanvas.width - startX, widthPx));
                const h = Math.max(1, Math.min(tempCanvas.height - startY, heightPx));
                
                const imgData = tempCtx.getImageData(startX, startY, w, h);
                const data = imgData.data;
                
                let sumR = 0, sumG = 0, sumB = 0;
                let count = 0;
                
                for (let i = 0; i < data.length; i += 4) {
                    sumR += data[i];
                    sumG += data[i+1];
                    sumB += data[i+2];
                    count++;
                }
                
                if (count === 0) return { r: 120, g: 120, b: 120, stdDev: 5, meanL: 120 };
                
                const avgR = sumR / count;
                const avgG = sumG / count;
                const avgB = sumB / count;
                const meanL = 0.299 * avgR + 0.587 * avgG + 0.114 * avgB;
                
                let varianceSum = 0;
                for (let i = 0; i < data.length; i += 4) {
                    const l = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
                    varianceSum += (l - meanL) * (l - meanL);
                }
                const stdDev = Math.sqrt(varianceSum / count);
                
                return { r: avgR, g: avgG, b: avgB, stdDev, meanL };
            }
            
            // Sample Cheeks (main region to analyze color, redness, and standard variation)
            const leftCheek = getRegionMetrics(activeLandmarks.leftCheek.x, activeLandmarks.leftCheek.y, 25, 25);
            const rightCheek = getRegionMetrics(activeLandmarks.rightCheek.x, activeLandmarks.rightCheek.y, 25, 25);
            
            const avgR = (leftCheek.r + rightCheek.r) / 2;
            const avgG = (leftCheek.g + rightCheek.g) / 2;
            const avgB = (leftCheek.b + rightCheek.b) / 2;
            const avgStd = (leftCheek.stdDev + rightCheek.stdDev) / 2;
            const avgL = (leftCheek.meanL + rightCheek.meanL) / 2;
            
            // 1. Redness: Cheek redness index
            let rednessVal = 8;
            if (avgR > 0) {
                const redDiff = avgR - avgG;
                rednessVal = Math.round((redDiff / avgR) * 110);
            }
            
            // 2. Dark Circles/Spots: Compare under-eye region to average cheek region
            const eyeUnderOffsetY = 0.045; 
            const leftUnderEyeL = getRegionMetrics(activeLandmarks.leftEye.x, activeLandmarks.leftEye.y + eyeUnderOffsetY, 15, 10);
            const rightUnderEyeL = getRegionMetrics(activeLandmarks.rightEye.x, activeLandmarks.rightEye.y + eyeUnderOffsetY, 15, 10);
            const avgEyeL = (leftUnderEyeL.meanL + rightUnderEyeL.meanL) / 2;

            if (skinMLModel) {
                // Feature vector representing critical regional landmarks properties
                const featureVector = [
                    avgR / 255, 
                    avgG / 255, 
                    avgB / 255, 
                    Math.min(1.0, avgStd / 50),
                    Math.min(2.0, avgEyeL / (avgL || 1)),
                    avgG > 0 ? avgR / avgG : 1.0,
                    avgL / 255,
                    leftCheek.meanL > 0 ? rightCheek.meanL / leftCheek.meanL : 1.0
                ];
                
                const inputTensor = tf.tensor2d([featureVector], [1, 8]);
                const prediction = skinMLModel.predict(inputTensor);
                const predictionData = prediction.dataSync();
                
                inputTensor.dispose();
                prediction.dispose();
                
                hydration = Math.round(predictionData[0] * 100);
                uniformity = Math.round(predictionData[1] * 100);
                redness = Math.round(predictionData[2] * 100);
                spots = Math.round(predictionData[3] * 100);
                
                // Keep dimensions within normal range
                hydration = Math.max(40, Math.min(99, hydration));
                uniformity = Math.max(40, Math.min(99, uniformity));
                redness = Math.max(5, Math.min(95, redness));
                spots = Math.max(5, Math.min(95, spots));
                
                console.log(`ML Neural Net Skin Diagnostics - Hydration: ${hydration}%, Uniformity: ${uniformity}%, Redness: ${redness}%, Spots: ${spots}%`);
            } else {
                redness = Math.max(5, Math.min(95, rednessVal));
                
                let uniformityVal = Math.round(100 - avgStd * 2.2);
                uniformity = Math.max(45, Math.min(99, uniformityVal));
                
                let spotsVal = 10;
                if (avgL > 0) {
                    const darkCircleRatio = avgEyeL / avgL;
                    if (darkCircleRatio < 1.0) {
                        spotsVal = Math.round((1 - darkCircleRatio) * 230 + 5);
                    } else {
                        spotsVal = Math.max(4, Math.round(avgStd * 0.7));
                    }
                }
                spots = Math.max(5, Math.min(95, spotsVal));
                
                let hydrationVal = Math.round(uniformity * 0.6 + (100 - redness) * 0.3 + 5);
                hydration = Math.max(50, Math.min(98, hydrationVal));
                
                console.log(`Heuristic Skin Diagnostics (Fallback) - Hydration: ${hydration}%, Uniformity: ${uniformity}%, Redness: ${redness}%, Spots: ${spots}%`);
            }
        } catch (e) {
            console.error("AI pixel estimation model error, using fallback calibration:", e);
        }
        
        return { hydration, uniformity, redness, spots };
    }

    async function triggerDiagnosticResults() {
        const results = analyzeSkinReal();
        const hydration = results.hydration;
        const uniformity = results.uniformity;
        const redness = results.redness;
        const spots = results.spots;
        
        const healthScore = Math.round((hydration + uniformity + (100 - redness) + (100 - spots)) / 4);
        
        // Show scan results card
        skinDiagnosticsResultsGrid.classList.remove('hidden-fade');
        skinDiagnosticsResultsGrid.classList.add('show-fade');
        
        const circ = 283;
        const offset = circ - (healthScore / 100) * circ;
        
        scoreTextLbl.innerText = healthScore;
        radialScoreCircle.style.strokeDashoffset = offset;
        
        valHydration.innerText = `${hydration}%`;
        barHydration.style.width = `${hydration}%`;
        
        valUniformity.innerText = `${uniformity}%`;
        barUniformity.style.width = `${uniformity}%`;
        
        valRedness.innerText = `${redness}%`;
        barRedness.style.width = `${redness}%`;
        
        valSpots.innerText = `${spots}%`;
        barSpots.style.width = `${spots}%`;
        
        // Save scan log to backend
        if (authToken) {
            try {
                const res = await fetch(`${API_BASE}/diagnostics`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({ score: healthScore, hydration, uniformity, redness, spots })
                });
                if (res.ok) {
                    showLuxuryToast("Dermal scan results secure in profile database.", "success");
                    fetchDiagnosticsHistory();
                }
            } catch (err) {
                console.error("Diagnostics save error", err);
            }
        } else {
            showLuxuryToast("Assessment finished (Running in Guest Mode).", "info");
        }
        
        setTimeout(() => {
            const targetElem = document.getElementById('skin-anchor');
            const headerOffset = 140;
            const elementPosition = targetElem.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }, 500);
    }

    async function fetchDiagnosticsHistory() {
        if (!authToken) return;
        try {
            const res = await fetch(`${API_BASE}/diagnostics`, {
                headers: getHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                renderDiagnosticsHistory(data);
            }
        } catch (err) {
            console.error("Failed to load skin history logs", err);
        }
    }

    function renderDiagnosticsHistory(logs) {
        if (!skinHistoryList) return;
        if (logs.length === 0) {
            skinHistoryList.innerHTML = '<p class="history-empty-text">No past assessments logged. Run your first AI scan above to initialize your skin tracking profile.</p>';
            return;
        }
        
        skinHistoryList.innerHTML = '';
        logs.forEach(l => {
            const card = document.createElement('div');
            card.className = 'skin-history-card';
            
            let dateVal = l.created_at;
            if (typeof dateVal === 'string' && !dateVal.includes('T')) {
                dateVal = dateVal.replace(' ', 'T') + 'Z';
            }
            const dateStr = new Date(dateVal).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric'
            });
            
            card.innerHTML = `
                <div class="history-card-header">
                    <span>Scan Log: <strong>${dateStr}</strong></span>
                    <span class="history-score-badge">Score: ${l.score}</span>
                </div>
                <div class="history-grid-meters">
                    <div class="h-meter-item">
                        <div class="h-meter-label"><span>Moisture</span><span>${l.hydration}%</span></div>
                        <div class="h-meter-bar-bg"><div class="h-meter-bar-fg" style="width: ${l.hydration}%;"></div></div>
                    </div>
                    <div class="h-meter-item">
                        <div class="h-meter-label"><span>Uniformity</span><span>${l.uniformity}%</span></div>
                        <div class="h-meter-bar-bg"><div class="h-meter-bar-fg" style="width: ${l.uniformity}%;"></div></div>
                    </div>
                    <div class="h-meter-item">
                        <div class="h-meter-label"><span>Redness</span><span>${l.redness}%</span></div>
                        <div class="h-meter-bar-bg"><div class="h-meter-bar-fg" style="width: ${l.redness}%;"></div></div>
                    </div>
                    <div class="h-meter-item">
                        <div class="h-meter-label"><span>Dark Circles</span><span>${l.spots}%</span></div>
                        <div class="h-meter-bar-bg"><div class="h-meter-bar-fg" style="width: ${l.spots}%;"></div></div>
                    </div>
                </div>
            `;
            skinHistoryList.appendChild(card);
        });
    }

    // ==========================================================================
    // Mobile Drawer Navigation Overlay Dialog handler
    // ==========================================================================
    if (mobileMenuBtn && mobileNavDrawer && closeDrawerBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileNavDrawer.classList.add('open');
        });
        
        closeDrawerBtn.addEventListener('click', () => {
            mobileNavDrawer.classList.remove('open');
        });
        
        drawerLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                mobileNavDrawer.classList.remove('open');
                
                const targetId = link.getAttribute('href').substring(1);
                const targetElem = document.getElementById(targetId);
                
                if (targetElem) {
                    const headerOffset = targetId === 'skin-anchor' ? 140 : 100;
                    const elementPosition = targetElem.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                    
                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }
});
