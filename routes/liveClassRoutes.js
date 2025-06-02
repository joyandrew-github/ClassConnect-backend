const express = require('express');
const router = express.Router();
const LiveClass = require('../models/LiveClass');
const Course = require('../models/Course');
const auth = require('../middleware/auth');

// Get all live classes for a course
router.get('/course/:courseId', auth, async (req, res) => {
  try {
    const liveClasses = await LiveClass.find({ course: req.params.courseId })
      .sort({ scheduledDate: -1 });
    res.json(liveClasses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new live class
router.post('/', auth, async (req, res) => {
  try {
    // Verify that the user is the teacher of the course
    const course = await Course.findOne({ 
      _id: req.body.course,
      teacher: req.user.id 
    });
    
    if (!course) {
      return res.status(403).json({ message: 'Not authorized to create live class for this course' });
    }

    const liveClass = new LiveClass(req.body);
    const savedLiveClass = await liveClass.save();
    
    // Add live class reference to course
    course.liveClasses.push(savedLiveClass._id);
    await course.save();
    
    res.status(201).json(savedLiveClass);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update a live class
router.put('/:id', auth, async (req, res) => {
  try {
    const liveClass = await LiveClass.findById(req.params.id);
    if (!liveClass) {
      return res.status(404).json({ message: 'Live class not found' });
    }

    // Verify that the user is the teacher of the course
    const course = await Course.findOne({ 
      _id: liveClass.course,
      teacher: req.user.id 
    });
    
    if (!course) {
      return res.status(403).json({ message: 'Not authorized to update this live class' });
    }

    Object.assign(liveClass, req.body);
    const updatedLiveClass = await liveClass.save();
    res.json(updatedLiveClass);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a live class
router.delete('/:id', auth, async (req, res) => {
  try {
    const liveClass = await LiveClass.findById(req.params.id);
    if (!liveClass) {
      return res.status(404).json({ message: 'Live class not found' });
    }

    // Verify that the user is the teacher of the course
    const course = await Course.findOne({ 
      _id: liveClass.course,
      teacher: req.user.id 
    });
    
    if (!course) {
      return res.status(403).json({ message: 'Not authorized to delete this live class' });
    }

    await LiveClass.deleteOne({ _id: liveClass._id });
    
    // Remove live class reference from course
    course.liveClasses = course.liveClasses.filter(lc => lc.toString() !== liveClass._id.toString());
    await course.save();
    
    res.json({ message: 'Live class deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 