import { Request, Response } from 'express';
import { Course } from '../models';
import User from '../models/user.model';
import { getStudentMentorships } from '../services/mentor.service';
import { cacheGet, cacheSet } from '../config/redis';

// GET /student/mentorship — mentors currently mentoring this student (+ pending)
export const getMyMentorships = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ status: 'failed', message: 'Unauthorized' });
    }

    const cacheKey = `mentor:student:${userId}:list`;
    const cachedData = await cacheGet(cacheKey);
    if (cachedData) {
      console.log('📦 Serving student mentorships from cache');
      return res.status(200).json({
        status: 'success',
        message: 'Mentorships retrieved successfully',
        mentorships: cachedData.mentorships,
        pendingRequests: cachedData.pendingRequests,
      });
    }

    const result = await getStudentMentorships(userId);

    if (!result.success) {
      return res.status(500).json({ status: 'failed', message: 'Failed to fetch mentorships' });
    }

    await cacheSet(cacheKey, { mentorships: result.mentorships, pendingRequests: result.pendingRequests }, 120);

    return res.status(200).json({
      status: 'success',
      message: 'Mentorships retrieved successfully',
      mentorships: result.mentorships,
      pendingRequests: result.pendingRequests,
    });
  } catch (error) {
    console.error('Error fetching student mentorships:', error);
    return res.status(500).json({ status: 'failed', message: 'Failed to fetch student mentorships' });
  }
};

export const updateRecommendations = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { recommendations } = req.body;

    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    if (!Array.isArray(recommendations)) {
      return res.status(400).json({ status: 'error', message: 'Invalid recommendations format' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { 
        recommendations,
        recommendationsProvided: true
      },
      { returnDocument: 'after' }
    );

    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    res.status(200).json({
      status: 'success',
      message: 'Recommendations updated successfully',
      user: {
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        recommendations: user.recommendations,
        recommendationsProvided: user.recommendationsProvided
      }
    });
  } catch (error) {
    console.error('Error updating recommendations:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update recommendations' });
  }
};

export const getRecommendedCourses = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    // If user has no recommendations, return popular courses
    if (!user.recommendations || user.recommendations.length === 0) {
      const popularCourses = await Course.find()
        .sort({ averageRating: -1 })
        .limit(6)
        .select('courseName description price duration averageRating previewThumbnail instructorDetails courseRequirements');

      return res.status(200).json({
        status: 'success',
        courses: popularCourses,
        recommendationType: 'popular'
      });
    }

    // Map user recommendations to course search terms
    const recommendationKeywords = {
      'web-development': ['web', 'html', 'css', 'javascript', 'react', 'frontend', 'fullstack'],
      'mobile-development': ['mobile', 'android', 'ios', 'flutter', 'react native', 'app'],
      'data-science': ['data', 'science', 'analytics', 'python', 'machine learning', 'statistics'],
      'machine-learning': ['machine learning', 'ml', 'ai', 'artificial intelligence', 'deep learning'],
      'cybersecurity': ['security', 'cyber', 'hacking', 'network', 'ethical', 'penetration'],
      'cloud-computing': ['cloud', 'aws', 'azure', 'devops', 'infrastructure', 'serverless'],
      'devops': ['devops', 'ci/cd', 'docker', 'kubernetes', 'deployment', 'automation'],
      'ui-ux-design': ['ui', 'ux', 'design', 'figma', 'interface', 'user experience']
    };

    // Build search query based on user recommendations
    const searchTerms = user.recommendations.flatMap(
      (rec: string) => recommendationKeywords[rec as keyof typeof recommendationKeywords] || []
    );

    // Find courses matching the search terms
    const recommendedCourses = await Course.find({
      $or: [
        { courseName: { $in: searchTerms.map(term => new RegExp(term, 'i')) } },
        { description: { $in: searchTerms.map(term => new RegExp(term, 'i')) } },
        { courseRequirements: { $in: searchTerms.map(term => new RegExp(term, 'i')) } }
      ]
    })
    .sort({ averageRating: -1 })
    .limit(6)
    .select('courseName description price duration averageRating previewThumbnail instructorDetails courseRequirements');

    // If not enough matches, fill with popular courses
    let finalCourses = recommendedCourses;
    if (recommendedCourses.length < 6) {
      const popularCourses = await Course.find({
        _id: { $nin: recommendedCourses.map(c => c._id) }
      })
      .sort({ averageRating: -1 })
      .limit(6 - recommendedCourses.length)
      .select('courseName description price duration averageRating previewThumbnail instructorDetails courseRequirements');
      
      finalCourses = [...recommendedCourses, ...popularCourses];
    }

    res.status(200).json({
      status: 'success',
      courses: finalCourses,
      recommendationType: 'personalized'
    });
  } catch (error) {
    console.error('Error fetching recommended courses:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch recommended courses' });
  }
};

export const getStudentStats = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    // Get user's enrolled courses
    const courses = await Course.find({ 'appliedUsers.userId': userId });
    
    // Calculate statistics
    const completedCourses = courses.filter(course => {
      // This would need to be based on actual completion tracking
      // For now, we'll assume completion based on course requirements
      return course.certificate && course.certificate.length > 0;
    }).length;

    const activeLearning = courses.length - completedCourses;
    
    // Calculate total hours (duration from courses)
    const totalHours = courses.reduce((sum, course) => sum + (course.duration || 0), 0);
    
    // Calculate badges/awards (placeholder - would need actual tracking)
    const badgesCount = Math.floor(completedCourses / 2) || 0;

    res.status(200).json({
      status: 'success',
      stats: {
        completedCourses,
        activeLearning,
        hoursStudied: totalHours,
        badgesAndAwards: badgesCount
      }
    });
  } catch (error) {
    console.error('Error fetching student stats:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch student statistics' });
  }
};

export const getStudentCertificates = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    // Get courses where the student is enrolled and has a certificate
    const courses = await Course.find({
      'appliedUsers.userId': userId,
      certificate: { $exists: true, $ne: null }
    })
    .select('courseName description duration certificate instructorDetails averageRating createdAt')
    .sort({ createdAt: -1 });

    // For each course, check if student has completed it (100% progress)
    const certificates = courses.filter(course => {
      // Filter out courses with "No Certificate" or invalid certificate URLs
      if (!course.certificate || 
          course.certificate === 'No Certificate' || 
          course.certificate === 'No' ||
          !course.certificate.startsWith('http')) {
        return false;
      }
      // This would ideally be based on actual completion tracking from localStorage or database
      // For now, we'll return all enrolled courses with valid certificates
      return true;
    }).map(course => ({
      _id: course._id,
      courseName: course.courseName,
      description: course.description,
      duration: course.duration,
      certificate: course.certificate,
      instructorDetails: course.instructorDetails,
      averageRating: course.averageRating,
      completedAt: (course as any).createdAt, // This would ideally be the actual completion date
      completionDate: (course as any).createdAt
    }));

    res.status(200).json({
      status: 'success',
      certificates
    });
  } catch (error) {
    console.error('Error fetching student certificates:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch student certificates' });
  }
};

export const getStudentProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    res.status(200).json({
      status: 'success',
      user: {
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        createdAt: user.createdAt,
        recommendationsProvided: user.recommendationsProvided || false,
        recommendations: user.recommendations || []
      }
    });
  } catch (error) {
    console.error('Error fetching student profile:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch student profile' });
  }
};
