const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Allow cross-origin requests
app.use(morgan('combined')); // Logging
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies

// Store notifications in memory (in production, use a database)
const notifications = [];
const deviceStats = new Map();

// 🎯 Main endpoint - receives notifications from your Android app
app.post('/api/notifications', (req, res) => {
    try {
        const notification = req.body;
        
        // Validate required fields
        if (!notification.package_name || !notification.app_name || !notification.title) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields",
                error: "package_name, app_name, and title are required"
            });
        }

        // Add server timestamp
        notification.server_received_at = new Date().toISOString();
        
        // Store notification
        notifications.push(notification);
        
        // Update device stats
        const deviceId = notification.device_id;
        if (deviceStats.has(deviceId)) {
            deviceStats.get(deviceId).count++;
            deviceStats.get(deviceId).last_seen = new Date().toISOString();
        } else {
            deviceStats.set(deviceId, {
                device_id: deviceId,
                count: 1,
                first_seen: new Date().toISOString(),
                last_seen: new Date().toISOString()
            });
        }

        // Log received notification
        console.log('\n🔔 === NEW NOTIFICATION RECEIVED ===');
        console.log(`📱 Device: ${notification.device_id}`);
        console.log(`📦 App: ${notification.app_name} (${notification.package_name})`);
        console.log(`📝 Title: ${notification.title}`);
        console.log(`💬 Text: ${notification.text}`);
        console.log(`⏰ Timestamp: ${new Date(notification.timestamp).toLocaleString()}`);
        console.log(`🌐 Server Time: ${notification.server_received_at}`);
        console.log('=====================================\n');

        // Send success response
        res.json({
            success: true,
            message: `Notification received successfully from ${notification.app_name}`,
            notification_id: notifications.length,
            total_notifications: notifications.length
        });

    } catch (error) {
        console.error('❌ Error processing notification:', error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
});

// 🏥 Health check endpoint - for testing server connectivity
app.post('/api/ping', (req, res) => {
    console.log('🏓 Ping received from Android app');
    res.json({
        success: true,
        message: "Server is running and ready to receive notifications!",
        server_time: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 📊 Get all notifications (for debugging/viewing)
app.get('/api/notifications', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const paginatedNotifications = notifications
        .slice(-limit - offset, notifications.length - offset)
        .reverse();

    res.json({
        success: true,
        total: notifications.length,
        showing: paginatedNotifications.length,
        notifications: paginatedNotifications
    });
});

// 📈 Get device statistics
app.get('/api/stats', (req, res) => {
    const stats = Array.from(deviceStats.values());
    
    res.json({
        success: true,
        total_devices: stats.length,
        total_notifications: notifications.length,
        devices: stats
    });
});

// 🗑️ Clear all notifications (for testing)
app.delete('/api/notifications', (req, res) => {
    const count = notifications.length;
    notifications.length = 0;
    deviceStats.clear();
    
    console.log(`🗑️ Cleared ${count} notifications`);
    res.json({
        success: true,
        message: `Cleared ${count} notifications`
    });
});

// 🏠 Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: "🔔 Notification Server is running!",
        endpoints: {
            "POST /api/notifications": "Receive notifications from Android app",
            "POST /api/ping": "Health check",
            "GET /api/notifications": "View received notifications",
            "GET /api/stats": "View device statistics",
            "DELETE /api/notifications": "Clear all notifications"
        },
        server_time: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('💥 Server Error:', err);
    res.status(500).json({
        success: false,
        message: "Internal server error",
        error: err.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Endpoint not found",
        requested: req.path
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🚀 ========================================');
    console.log('🔔 NOTIFICATION SERVER STARTED!');
    console.log(`🌐 Server running on: http://localhost:${PORT}`);
    console.log(`📡 API Base URL: http://localhost:${PORT}/api/`);
    console.log('🎯 Ready to receive notifications!');
    console.log('==========================================\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('👋 Server shutting down gracefully...');
    process.exit(0);
});
