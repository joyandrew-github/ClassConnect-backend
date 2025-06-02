const express = require('express');
const router = express.Router();
const Quiz = require('../models/Quiz');
const Course = require('../models/Course');
const auth = require('../middleware/auth');

// Get all quizzes for a course
router.get('/course/:courseId', auth, async (req, res) => {
  try {
    const quizzes = await Quiz.find({ course: req.params.courseId })
      .populate('submissions.student', 'name email')
      .sort({ createdAt: -1 });
    res.json(quizzes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new quiz
router.post('/', auth, async (req, res) => {
  try {
    // Verify that the user is the teacher of the course
    const course = await Course.findOne({ 
      _id: req.body.course,
      teacher: req.user.id 
    });
    
    if (!course) {
      return res.status(403).json({ message: 'Not authorized to create quiz for this course' });
    }

    const quiz = new Quiz(req.body);
    const savedQuiz = await quiz.save();
    
    // Add quiz reference to course
    course.quizzes.push(savedQuiz._id);
    await course.save();
    
    res.status(201).json(savedQuiz);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update a quiz
router.put('/:id', auth, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Verify that the user is the teacher of the course
    const course = await Course.findOne({ 
      _id: quiz.course,
      teacher: req.user.id 
    });
    
    if (!course) {
      return res.status(403).json({ message: 'Not authorized to update this quiz' });
    }

    Object.assign(quiz, req.body);
    const updatedQuiz = await quiz.save();
    res.json(updatedQuiz);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a quiz
router.delete('/:id', auth, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Verify that the user is the teacher of the course
    const course = await Course.findOne({ 
      _id: quiz.course,
      teacher: req.user.id 
    });
    
    if (!course) {
      return res.status(403).json({ message: 'Not authorized to delete this quiz' });
    }

    // await quiz.remove();
    await Quiz.deleteOne({ _id: quiz._id });
    
    // Remove quiz reference from course
    course.quizzes = course.quizzes.filter(q => q.toString() !== quiz._id.toString());
    await course.save();
    
    res.json({ message: 'Quiz deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Submit quiz answers
router.post('/:id/submit', auth, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Check if student has already submitted
    const existingSubmission = quiz.submissions.find(
      sub => sub.student.toString() === req.user.id
    );
    
    if (existingSubmission) {
      return res.status(400).json({ message: 'You have already submitted this quiz' });
    }

    // Calculate score
    let score = 0;
    const answers = req.body.answers.map(answer => {
      const question = quiz.questions.id(answer.questionId);
      const isCorrect = question.options[answer.selectedOption].isCorrect;
      if (isCorrect) score += question.points;
      
      return {
        questionId: answer.questionId,
        selectedOption: answer.selectedOption,
        isCorrect
      };
    });

    // Add submission
    quiz.submissions.push({
      student: req.user.id,
      answers,
      score
    });

    const updatedQuiz = await quiz.save();
    res.json(updatedQuiz);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router; 