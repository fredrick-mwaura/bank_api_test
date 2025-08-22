import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging.js";

    // Firebase configuration
const firebaseConfig = {
  apiKey: "<%= process.env.FIREBASE_API_KEY || 'your-api-key' %>",
  authDomain: "messaging-702.firebase.com",
  projectId: "messaging-702",
    storageBucket: "messaging-702.firebasestorage.app",
    messagingSenderId: "134922907791",
    appId: "1:134922907791:web:<%= process.env.FIREBASE_APP_ID || 'your-app-id' %>"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const messaging = getMessaging(app);
  // VAPID key for push notifications
  const vapidKey = "<%= process.env.FIREBASE_VAPID_KEY || 'your-vapid-key' %>";
  // API base URL
  const API_BASE_URL = '<%= process.env.API_BASE_URL || "http://localhost:5000/api" %>';
  // Get device ID and push token
  async function initializeDeviceTracking() {
    try {
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        const currentToken = await getToken(messaging, {
          vapidKey: vapidKey
        });

        if (currentToken) {
          $('#pushToken').val(currentToken);
          $('#deviceId').val(currentToken); // Using FCM token as device ID
          console.log('FCM Token obtained:', currentToken);

          // Send token to server via AJAX
          $.ajax({
            url: `${API_BASE_URL}/auth/saveDevice`,
            method: 'POST',
            data: {
              token: currentToken,
              deviceId: currentToken
            },
            success: function(response) {
              console.log('Token successfully sent to server:', response);
            },
            error: function(xhr, status, error) {
              console.error('Error sending token to server:', error);
            }
          });

        } else {
          console.log('No registration token available.');
        }
      } else {
        console.log('Notification permission denied.');
      }
    } catch (error) {
        console.error('Error getting FCM token:', error);
    }
  }


  // Handle foreground messages
  onMessage(messaging, (payload) => {
    console.log('Message received in foreground:', payload);
      
    // Show notification to user
    if (payload.notification) {
      showNotification(payload.notification.title, payload.notification.body);
    }
  });

  // Show notification function
  function showNotification(title, body) {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body: body,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png'
      });
    }
  }

  // Login form handler
  $('#loginForm').on('submit', async (e) => {
    e.preventDefault();
    await handleLogin();
  });

  // Handle login function
  async function handleLogin() {
    const loginButton = $('#loginButton');
    const loginButtonText = $('#loginButtonText');
    const loginButtonLoading = $('#loginButtonLoading');
    const errorMessage = $('#errorMessage');
    const successMessage = $('#successMessage');
    const errorText = $('#errorText');
    const successText = $('#successText');

    // Get form data
    const email = $('#email').val();
    const password = $('#password').val();
    const rememberMe = $('#rememberMe').checked;
    const deviceId = $('#deviceId').val();
    const pushToken = $('#pushToken').val();

    // Show loading state
    loginButton.prop('disabled', true);
    loginButtonText.addClass('hidden');
    loginButtonLoading.removeClass('hidden');
    errorMessage.addClass('hidden');
    successMessage.addClass('hidden');

    try {//StorngPass123!
      let body = JSON.stringify({
        email, password,rememberMe, deviceId, pushToken
      })
      $.ajax({
          url: `${API_BASE_URL}/auth/login`,
          method: 'POST',
          data: body,
          success: function(response) {
            // Store tokens
            let data = response.data
            const storage = rememberMe ? localStorage : sessionStorage;
            storage.setItem('accessToken', data.data.tokens.accessToken);
            storage.setItem('refreshToken', data.data.tokens.refreshToken);
            localStorage.setItem('user', JSON.stringify(data.data.user));

            successText.textContent = `Welcome back, ${data.data.user.firstName}!`;
            successMessage.classList.remove('hidden');

            setTimeout(() => {
              window.location.href = '/';
            }, 1500);

            console.log('Login successful:');
          },
          error: function(xhr, status, error) {
            errorText.textContent = error || 'Login failed. Please try again.';
            errorMessage.removeClass('hidden');
            console.error('error in login: ', error);
          }
      });

    } catch (error) {
      console.error('Login error:', error);
      errorText.textContent = 'Network error. Please check your connection and try again.';
      errorMessage.classList.remove('hidden');
    } finally {
      // Reset button state
      loginButton.prop('disabled', false)
      loginButtonText.removeClass('hidden');
      loginButtonLoading.addClass('hidden');
    }
  }

  // Initialize device tracking when page loads
  window.addEventListener('load', () => {
    initializeDeviceTracking();
  });

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/js/reg.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration);
      })
       .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  }
  