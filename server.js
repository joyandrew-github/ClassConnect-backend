require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const courseRoutes = require('./routes/courseRoutes');
const quizRoutes = require('./routes/quizRoutes');
// const userRoutes = require('./routes/userRoutes');
const liveClassRoutes = require('./routes/liveClassRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads', 'materials');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/quizzes', quizRoutes);
// app.use('/api/users', userRoutes);
app.use('/api/live-classes', liveClassRoutes);

// Connect to Database
connectDB();

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// --- SOCKET.IO CHAT INTEGRATION ---
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for dev; restrict in prod
    methods: ['GET', 'POST']
  }
});

// --- LIVE CLASS ATTENDANCE & SCREEN SHARE ---
const liveClassAttendees = {}; // { liveClassId: Set of user names }
const liveClassScreens = {};   // { liveClassId: { sharing: bool, teacherSocket: id } }

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('chat message', (msg) => {
    // Broadcast the message to all clients
    io.emit('chat message', msg);
  });

  // Student joins a live class
  socket.on('join live class', ({ liveClassId, user }) => {
    socket.join(liveClassId);
    if (!liveClassAttendees[liveClassId]) liveClassAttendees[liveClassId] = new Set();
    liveClassAttendees[liveClassId].add(user);
    // Broadcast updated attendee list
    io.to(liveClassId).emit('live class attendees', Array.from(liveClassAttendees[liveClassId]));
  });

  // Student leaves a live class
  socket.on('leave live class', ({ liveClassId, user }) => {
    socket.leave(liveClassId);
    if (liveClassAttendees[liveClassId]) {
      liveClassAttendees[liveClassId].delete(user);
      io.to(liveClassId).emit('live class attendees', Array.from(liveClassAttendees[liveClassId]));
    }
  });

  // Teacher starts/stops screen sharing
  socket.on('screen share', ({ liveClassId, sharing }) => {
    liveClassScreens[liveClassId] = { sharing, teacherSocket: socket.id };
    io.to(liveClassId).emit('screen share', { sharing });
  });

  // WebRTC signaling for screen sharing
  socket.on('student wants stream', ({ liveClassId, studentSocketId }) => {
    // Forward to teacher in this live class
    socket.to(liveClassId).emit('student wants stream', { studentSocketId });
  });

  socket.on('teacher signal', ({ studentSocketId, signal }) => {
    // Forward teacher's WebRTC signal to student
    io.to(studentSocketId).emit('teacher signal', { signal });
  });

  socket.on('student signal', ({ liveClassId, signal }) => {
    // Forward student's WebRTC signal to teacher in this live class
    socket.to(liveClassId).emit('student signal', { signal, studentSocketId: socket.id });
  });

  socket.on('disconnecting', () => {
    // Remove user from all live classes they joined
    for (const liveClassId of Object.keys(liveClassAttendees)) {
      liveClassAttendees[liveClassId].delete(socket.id);
      io.to(liveClassId).emit('live class attendees', Array.from(liveClassAttendees[liveClassId]));
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});