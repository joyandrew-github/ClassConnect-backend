const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const User = require('../models/User');


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/materials')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'video/mp4',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, MP4, PNG, JPG, JPEG, PPT, and PPTX files are allowed.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Get all courses for a teacher
router.get('/teacher', auth, async (req, res) => {
  try {
    const courses = await Course.find({ teacher: req.user.id })
      .populate('students', 'name email')
      .sort({ createdAt: -1 });
    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new course
router.post('/', auth, async (req, res) => {
  try {
    const course = new Course({
      ...req.body,
      teacher: req.user.id
    });
    const savedCourse = await course.save();
    res.status(201).json(savedCourse);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update a course
router.put('/:id', auth, async (req, res) => {
  try {
    const course = await Course.findOne({ _id: req.params.id, teacher: req.user.id });
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    
    Object.assign(course, req.body);
    const updatedCourse = await course.save();
    res.json(updatedCourse);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a course
router.delete('/:id', auth, async (req, res) => {
  try {
    const course = await Course.findOneAndDelete({ _id: req.params.id, teacher: req.user.id });
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add study material to a course
router.post('/:id/materials', auth, upload.single('file'), async (req, res) => {
  try {
    const course = await Course.findOne({ _id: req.params.id, teacher: req.user.id });
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const material = {
      title: req.body.title,
      description: req.body.description,
      fileUrl: `/uploads/materials/${req.file.filename}`,
      type: path.extname(req.file.originalname).toLowerCase().slice(1),
      size: req.file.size,
      uploadDate: new Date(),
      downloads: 0
    };
    
    course.materials.push(material);
    const updatedCourse = await course.save();
    res.json(updatedCourse);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete study material
router.delete('/:courseId/materials/:materialId', auth, async (req, res) => {
  try {
    const course = await Course.findOne({ 
      _id: req.params.courseId,
      teacher: req.user.id 
    });
    
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    
    const material = course.materials.id(req.params.materialId);
    if (!material) {
      return res.status(404).json({ message: 'Material not found' });
    }
    
    // Remove the material
    course.materials = course.materials.filter(
      m => m._id.toString() !== req.params.materialId
    );
    
    await course.save();
    res.json({ message: 'Material deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Schedule a live class
router.post('/:id/live-classes', auth, async (req, res) => {
  try {
    const course = await Course.findOne({ _id: req.params.id, teacher: req.user.id });
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    
    course.liveClasses.push(req.body);
    const updatedCourse = await course.save();
    res.json(updatedCourse);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get all courses (for students)
router.get('/', auth, async (req, res) => {
  try {
    const courses = await Course.find()
      .populate('teacher', 'name email')
      .populate('students', 'name email')
      .sort({ createdAt: -1 });
    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Enroll student in a course
router.post('/:id/enroll', auth, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Check if student is already enrolled
    if (course.students.includes(req.user.id)) {
      return res.status(400).json({ message: 'Already enrolled in this course' });
    }

    course.students.push(req.user.id);
    await course.save();

    // Also add course to user's courses array
    await User.findByIdAndUpdate(req.user.id, { $addToSet: { courses: course._id } });

    res.json({ message: 'Successfully enrolled' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Unenroll student from a course
router.post('/:id/unenroll', auth, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Check if student is enrolled
    if (!course.students.includes(req.user.id)) {
      return res.status(400).json({ message: 'Not enrolled in this course' });
    }

    course.students = course.students.filter(studentId => studentId.toString() !== req.user.id);
    await course.save();

    // Also remove course from user's courses array
    await User.findByIdAndUpdate(req.user.id, { $pull: { courses: course._id } });

    res.json({ message: 'Successfully unenrolled' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 