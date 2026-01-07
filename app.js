
// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    doc,
    updateDoc,
    deleteDoc,
    onSnapshot, 
    query, 
    orderBy, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// ⚠️ CẤU HÌNH FIREBASE CỦA BẠN Ở ĐÂY ⚠️
// Bạn cần thay thế object bên dưới bằng thông tin từ Firebase Console của bạn
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAsgPPLpDppirUHXkAvozAaZVPDbFtbJYA",
    authDomain: "managecccd.firebaseapp.com",
    projectId: "managecccd",
    storageBucket: "managecccd.firebasestorage.app",
    messagingSenderId: "728638757442",
    appId: "1:728638757442:web:7ee1eb3783e913875a2bdb",
    measurementId: "G-YY0MYY2KDM"
};

// ==========================================
// Logic Ứng dụng
// ==========================================

let app;
let db;
let customers = []; // Local cache for powerful client-side search
let editingId = null; // Track which ID is being edited

try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
} catch (e) {
    console.error("Lỗi khởi tạo Firebase. Hãy kiểm tra config.", e);
}

// DOM Elements
const searchInput = document.getElementById('searchInput');
const customerListEl = document.getElementById('customerList');
const addBtn = document.getElementById('addBtn');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.querySelector('.modal-header h2'); // To change title Add/Edit
const closeBtn = document.getElementById('closeBtn');
const cancelBtn = document.getElementById('cancelBtn');
const addForm = document.getElementById('addForm');
const nameInput = document.getElementById('nameInput');
const cccdInput = document.getElementById('cccdInput');
const cccdCount = document.getElementById('cccdCount');
const cccdError = document.getElementById('cccdError');
const submitBtn = document.querySelector('.btn-submit');
const btnText = document.querySelector('.btn-text');
const btnSpinner = document.querySelector('.btn-spinner');

// Action Sheet Elements
const actionSheetOverlay = document.getElementById('actionSheetOverlay');
const actionEditBtn = document.getElementById('actionEditBtn');
const actionDeleteBtn = document.getElementById('actionDeleteBtn');
const actionCancelBtn = document.getElementById('actionCancelBtn');
let selectedCustomerId = null; // Used for action sheet context

// Install PWA Logic
let deferredPrompt;
const installBanner = document.getElementById('installBanner');
const installBtn = document.getElementById('installBtn');
const closeInstallBtn = document.getElementById('closeInstallBtn');

// Check if already in standalone mode
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

if (!isStandalone) {
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later.
        deferredPrompt = e;
        // Update UI to notify the user they can add to home screen
        showInstallBanner();
    });
}

function showInstallBanner() {
    if (installBanner) installBanner.classList.add('show');
}

function hideInstallBanner() {
    if (installBanner) installBanner.classList.remove('show');
}

if (installBtn) {
    installBtn.addEventListener('click', async () => {
        hideInstallBanner();
        // Show the install prompt
        if (deferredPrompt) {
            deferredPrompt.prompt();
            // Wait for the user to respond to the prompt
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            deferredPrompt = null;
        }
    });
}

if (closeInstallBtn) {
    closeInstallBtn.addEventListener('click', hideInstallBanner);
}

// Update Notification Logic
const updatePopup = document.getElementById('updatePopup');
const updateBtn = document.getElementById('updateBtn');
let newWorker;

function showUpdatePopup() {
    if(updatePopup) updatePopup.classList.add('active');
}

if (updateBtn) {
    updateBtn.addEventListener('click', () => {
        if (newWorker) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
        }
        // Fallback if SW magic fails
        setTimeout(() => window.location.reload(), 500); 
    });
}

// Register Service Worker with Update Logic
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            console.log('SW registered');

            // 1. SW is waiting (Update downloaded but not active)
            if (reg.waiting) {
                newWorker = reg.waiting;
                showUpdatePopup();
                return;
            }

            // 2. SW is installing (New update found)
            reg.addEventListener('updatefound', () => {
                newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    // Has network.state changed?
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdatePopup();
                    }
                });
            });
        });

        // 3. Reload when new SW takes control
        let refreshing;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            window.location.reload();
            refreshing = true;
        });
    });
}

// -----------------------------------------------------
// REALTIME DATA LISTENER
// -----------------------------------------------------
function initDataListener() {
    if (!db) return;

    const q = query(collection(db, "customers"), orderBy("createdAt", "desc"));
    
    // Using onSnapshot for Realtime updates
    onSnapshot(q, (querySnapshot) => {
        customers = [];
        querySnapshot.forEach((doc) => {
            customers.push({ id: doc.id, ...doc.data() });
        });
        renderList(customers);
    }, (error) => {
        console.error("Lỗi tải dữ liệu: ", error);
        customerListEl.innerHTML = `<div class="empty-state">Lỗi kết nối hoặc chưa cấu hình Firebase.</div>`;
    });
}

// -----------------------------------------------------
// RENDER FUNCTION with LONG PRESS
// -----------------------------------------------------
// Toast Logic
const toastContainer = document.getElementById('toastContainer');
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// -----------------------------------------------------
// RENDER FUNCTION with SWIPE & COPY
// -----------------------------------------------------
// Track currently open swipe card to close others
let activeSwipeCard = null;

// Close swipe when clicking anywhere outside of specific action buttons
document.addEventListener('click', (e) => {
    if (activeSwipeCard && !e.target.closest('.swipe-btn')) {
        activeSwipeCard.style.transform = `translateX(0)`;
        activeSwipeCard = null;
    }
});

function renderList(listData) {
    customerListEl.innerHTML = '';
    activeSwipeCard = null; // Reset

    if (listData.length === 0) {
        customerListEl.innerHTML = `
            <div class="empty-state">
                <i class="fa-regular fa-folder-open"></i>
                <p>Chưa có dữ liệu</p>
            </div>
        `;
        return;
    }

    listData.forEach(customer => {
        const cardWrapper = document.createElement('div');
        cardWrapper.className = 'customer-card';
        cardWrapper.setAttribute('data-id', customer.id);

        cardWrapper.innerHTML = `
            <div class="card-actions-swipe">
                <button class="swipe-btn swipe-edit" id="btn-edit-${customer.id}">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="swipe-btn swipe-delete" id="btn-delete-${customer.id}">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
            
            <div class="card-front" id="card-front-${customer.id}">
                <div class="card-content">
                    <div class="card-icon">
                        <i class="fa-solid fa-user"></i>
                    </div>
                    <div class="card-info">
                        <span class="card-name">${escapeHtml(customer.name)}</span>
                        <span class="card-cccd" id="cccd-copy-${customer.id}">
                            <i class="fa-regular fa-copy"></i> ${escapeHtml(customer.cccd)}
                        </span>
                    </div>
                </div>
            </div>
        `;

        customerListEl.appendChild(cardWrapper);

        // --- HANDLERS ---
        const cardFront = cardWrapper.querySelector('.card-front');
        const cccdEl = cardWrapper.querySelector(`#cccd-copy-${customer.id}`);
        const editBtn = cardWrapper.querySelector(`#btn-edit-${customer.id}`);
        const deleteBtn = cardWrapper.querySelector(`#btn-delete-${customer.id}`);

        // 1. COPY CCCD Handler
        cccdEl.addEventListener('click', (e) => {
            navigator.clipboard.writeText(customer.cccd).then(() => {
                showToast("Đã sao chép CCCD");
            }).catch(err => {
                console.error('Could not copy text: ', err);
            });
        });

        // 2. SWIPE LOGIC
        let startX = 0;
        let startPos = 0;
        let isDragging = false;
        
        const handleTouchStart = (e) => {
            startX = e.touches[0].clientX;
            isDragging = true;
            
            // Get current position
            const style = window.getComputedStyle(cardFront);
            if (style.transform === 'none') {
                startPos = 0;
            } else {
                const matrix = new WebKitCSSMatrix(style.transform);
                startPos = matrix.m41;
            }

            // Remove transition for instant drag
            cardFront.style.transition = 'none';

            // Close other open cards (if any)
            if (activeSwipeCard && activeSwipeCard !== cardFront) {
                // Animate other card closing
                activeSwipeCard.style.transition = 'transform 0.2s ease-out';
                activeSwipeCard.style.transform = `translateX(0)`;
                activeSwipeCard = null;
            }
        };

        const handleTouchMove = (e) => {
            if (!isDragging) return;
            const currentX = e.touches[0].clientX;
            const diff = currentX - startX;
            
            // Calculate new position based on start position
            let newPos = startPos + diff;

            // Constrain movement: max right 0 (closed), max left -160 (elastic limit)
            if (newPos > 0) newPos = 0;
            if (newPos < -160) newPos = -160;

            cardFront.style.transform = `translateX(${newPos}px)`;
        };

        const handleTouchEnd = (e) => {
            if (!isDragging) return;
            isDragging = false;
            
            // Restore smooth transition
            cardFront.style.transition = 'transform 0.2s ease-out';
            
            const currentX = e.changedTouches[0].clientX;
            const dist = currentX - startX; // negative=left, positive=right
            
            // Determine initial state based on startPos
            // (Assuming -140 is open, 0 is closed)
            const isInitiallyOpen = Math.abs(startPos) > 70;
            
            let shouldBeOpen = isInitiallyOpen;

            if (!isInitiallyOpen) {
                // CLOSED -> OPEN if pulled left > 30px
                if (dist < -30) shouldBeOpen = true;
            } else {
                // OPEN -> CLOSE if pulled right > 30px
                if (dist > 30) shouldBeOpen = false;
            }

            if (shouldBeOpen) {
                cardFront.style.transform = `translateX(-140px)`;
                activeSwipeCard = cardFront;
            } else {
                cardFront.style.transform = `translateX(0)`;
                if (activeSwipeCard === cardFront) activeSwipeCard = null;
            }
        };

        cardFront.addEventListener('touchstart', handleTouchStart, {passive: true});
        cardFront.addEventListener('touchmove', handleTouchMove, {passive: true});
        cardFront.addEventListener('touchend', handleTouchEnd);
        


        // 3. ACTION BUTTON HANDLERS
        editBtn.addEventListener('click', () => {
             // Close swipe
             cardFront.style.transform = `translateX(0)`;
             activeSwipeCard = null;
             openModal(true, customer);
        });

        deleteBtn.addEventListener('click', () => {
            // Close swipe
            cardFront.style.transform = `translateX(0)`;
            activeSwipeCard = null;
            
            // Trigger Delete Flow
            showConfirmDialog("Bạn có chắc chắn muốn xóa khách hàng này không?", async () => {
                try {
                    await deleteDoc(doc(db, "customers", customer.id));
                } catch (error) {
                    console.error(error);
                    alert("Lỗi: " + error.message);
                }
            });
        });
    });
}

// Helper to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// -----------------------------------------------------
// SEARCH LOGIC
// -----------------------------------------------------
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (!term) {
        renderList(customers);
        return;
    }

    // Powerful search: Match name or CCCD
    const filtered = customers.filter(c => {
        // Safe check for properties
        const nameMatch = c.name ? c.name.toLowerCase().includes(term) : false;
        const cccdMatch = c.cccd ? c.cccd.toString().includes(term) : false;
        return nameMatch || cccdMatch;
    });

    renderList(filtered);
});

// -----------------------------------------------------
// MODAL & FORM LOGIC
// -----------------------------------------------------
const MAX_CCCD = 12;

// Add Btn Click
addBtn.addEventListener('click', () => {
    openModal(); // Default is Add mode
});

function openModal(isEdit = false, data = null) {
    modalOverlay.classList.add('active');
    
    // Reset state
    resetValidation();
    
    if (isEdit && data) {
        // Edit Mode
        editingId = data.id;
        modalTitle.textContent = "Chỉnh sửa thông tin";
        nameInput.value = data.name;
        cccdInput.value = data.cccd;
        btnText.textContent = "Cập nhật";
        updateCCCDCounter();
    } else {
        // Add Mode
        editingId = null;
        modalTitle.textContent = "Thêm khách hàng";
        addForm.reset();
        btnText.textContent = "Lưu";
        updateCCCDCounter();
        setTimeout(() => nameInput.focus(), 100); 
    }
}

// Close Modal
function closeModal() {
    modalOverlay.classList.remove('active');
    setTimeout(() => {
        addForm.reset();
        editingId = null;
    }, 300);
}

closeBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

// CCCD Validation & Counter
cccdInput.addEventListener('input', (e) => {
    const val = e.target.value;
    
    // Only allow numbers
    if (/[^0-9]/.test(val)) {
        e.target.value = val.replace(/[^0-9]/g, '');
    }

    updateCCCDCounter();
});

function updateCCCDCounter() {
    let currentLength = 0;
    if (cccdInput.value) {
         currentLength = cccdInput.value.length;
    }
    
    // Validation visual feedback
    if (currentLength > MAX_CCCD) {
        cccdInput.value = cccdInput.value.slice(0, MAX_CCCD);
        currentLength = MAX_CCCD;
    }
    
    const remaining = MAX_CCCD - currentLength;
    cccdCount.textContent = `Còn ${remaining} ký tự`;

    if (currentLength === 12) {
        cccdCount.style.color = 'var(--success-color)';
    } else {
        cccdCount.style.color = 'var(--text-secondary)';
    }
}

function resetValidation() {
    cccdError.textContent = '';
    cccdCount.textContent = `Còn ${MAX_CCCD} ký tự`;
    cccdCount.style.color = 'var(--text-secondary)';
    submitBtn.disabled = false;
}

// Handle Form Submit (Add or Update)
addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = nameInput.value.trim();
    const cccd = cccdInput.value.trim();

    if (cccd.length !== 12) {
        cccdError.textContent = 'CCCD phải có đúng 12 số';
        return;
    }

    // CHECK DUPLICATE CCCD
    const isDuplicate = customers.some(c => c.cccd === cccd && c.id !== editingId);
    if (isDuplicate) {
        cccdError.textContent = 'Số CCCD này đã tồn tại!';
        // Shake validation
        cccdInput.classList.add('shake');
        setTimeout(() => cccdInput.classList.remove('shake'), 500);
        return;
    }

    // Loading state
    submitBtn.disabled = true;
    btnText.classList.add('hidden');
    btnSpinner.classList.remove('hidden');

    try {
        if (editingId) {
            // UPDATE EXISTING
            const customerRef = doc(db, "customers", editingId);
            await updateDoc(customerRef, {
                name: name,
                cccd: cccd,
                updatedAt: serverTimestamp()
            });
        } else {
            // ADD NEW
            await addDoc(collection(db, "customers"), {
                name: name,
                cccd: cccd,
                createdAt: serverTimestamp()
            });
        }
        
        closeModal();
    } catch (error) {
        console.error("Error saving document: ", error);
        alert("Có lỗi xảy ra: " + error.message);
    } finally {
        submitBtn.disabled = false;
        btnText.classList.remove('hidden');
        btnSpinner.classList.add('hidden');
    }
});

// -----------------------------------------------------
// ACTION SHEET LOGIC (Delete/Edit)
// -----------------------------------------------------
function openActionSheet(id) {
    selectedCustomerId = id;
    actionSheetOverlay.classList.add('active');
}

function closeActionSheet() {
    actionSheetOverlay.classList.remove('active');
    setTimeout(() => {
        selectedCustomerId = null;
    }, 300);
}

actionCancelBtn.addEventListener('click', closeActionSheet);
actionSheetOverlay.addEventListener('click', (e) => {
    if (e.target === actionSheetOverlay) closeActionSheet();
});

// -----------------------------------------------------
// CUSTOM CONFIRM DIALOG LOGIC
// -----------------------------------------------------
const confirmModalOverlay = document.getElementById('confirmModalOverlay');
const confirmOkBtn = document.getElementById('confirmOkBtn');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');
const confirmMessage = document.getElementById('confirmMessage');
let confirmCallback = null; // Store function to run on OK

function showConfirmDialog(msg, callback) {
    confirmMessage.textContent = msg;
    confirmCallback = callback;
    confirmModalOverlay.classList.add('active');
}

function closeConfirmDialog() {
    confirmModalOverlay.classList.remove('active');
    confirmCallback = null;
}

confirmCancelBtn.addEventListener('click', closeConfirmDialog);
// Close on overlay click
confirmModalOverlay.addEventListener('click', (e) => {
    if (e.target === confirmModalOverlay) closeConfirmDialog();
});

confirmOkBtn.addEventListener('click', async () => {
    if (confirmCallback) {
        // Show loading locally on the delete button
        const btnText = confirmOkBtn.querySelector('.btn-text');
        const btnSpinner = confirmOkBtn.querySelector('.btn-spinner');
        
        confirmOkBtn.disabled = true;
        btnText.classList.add('hidden');
        btnSpinner.classList.remove('hidden');
        
        try {
            await confirmCallback();
        } catch (e) {
            console.error(e);
        } finally {
            // Reset button state
            confirmOkBtn.disabled = false;
            btnText.classList.remove('hidden');
            btnSpinner.classList.add('hidden');
            closeConfirmDialog();
        }
    }
});

// Edit Button Click
actionEditBtn.addEventListener('click', () => {
    if (!selectedCustomerId) return;
    const customer = customers.find(c => c.id === selectedCustomerId);
    if (customer) {
        closeActionSheet();
        setTimeout(() => {
            openModal(true, customer); // Open modal in Edit mode
        }, 300); // Wait for action sheet to close
    }
});

// Delete Button Click
actionDeleteBtn.addEventListener('click', () => {
    const idToDelete = selectedCustomerId; // Capture ID before it gets cleared
    if (!idToDelete) return;
    
    // Close Action Sheet first
    closeActionSheet();

    // Show Custom Confirm Dialog
    setTimeout(() => {
        showConfirmDialog("Bạn có chắc chắn muốn xóa khách hàng này không? Hành động này không thể hoàn tác.", async () => {
            try {
                // Use the captured idToDelete, not the global one which is now null
                await deleteDoc(doc(db, "customers", idToDelete)); 
            } catch (error) {
                console.error("Error removing document: ", error);
                alert("Không thể xóa: " + error.message);
            }
        });
    }, 300); // Wait for action sheet to close
});


// Start app
if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    initDataListener();
} else {
    // Show empty state telling user to config
    customerListEl.innerHTML = `
        <div class="empty-state">
            <i class="fa-solid fa-gear"></i>
            <p>Vui lòng cấu hình Firebase trong file app.js</p>
        </div>
    `;
}
