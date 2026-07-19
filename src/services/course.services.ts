const addCourseValidation = (payload: { courseName?: string; description?: string; courseVideos?: any[]; courseRequirements?: any[]; price?: number; duration?: number; certificate?: string; programmingCodes?: any[]; assets?: any[]; quizzes?: any[] }, instructorId?: string) => {
    const { courseName, description, courseVideos, courseRequirements, price, duration, certificate, programmingCodes, assets, quizzes } = payload;

    // Validate required fields
    if (!courseName) {
        return {
            isValid: false,
            message: "Course name is required"
        };
    }

    if (!description) {
        return {
            isValid: false,
            message: "Description is required"
        };
    }

    if (!price) {
        return {
            isValid: false,
            message: "Price is required"
        };
    }

    if (!duration) {
        return {
            isValid: false,
            message: "Duration is required"
        };
    }

    if (!certificate) {
        return {
            isValid: false,
            message: "Certificate is required"
        };
    }

    // Validate courseVideos structure
    if (courseVideos && !Array.isArray(courseVideos)) {
        return {
            isValid: false,
            message: "courseVideos must be an array"
        };
    }

    if (courseVideos && courseVideos.length > 0) {
        for (const video of courseVideos) {
            if (!video.videoUrl) {
                return {
                    isValid: false,
                    message: "Each video must have a videoUrl"
                };
            }
        }
    }

    // Validate programmingCodes structure
    if (programmingCodes && !Array.isArray(programmingCodes)) {
        return {
            isValid: false,
            message: "programmingCodes must be an array"
        };
    }

    // Validate assets structure
    if (assets && !Array.isArray(assets)) {
        return {
            isValid: false,
            message: "assets must be an array"
        };
    }

    // Validate quizzes structure
    if (quizzes && !Array.isArray(quizzes)) {
        return {
            isValid: false,
            message: "quizzes must be an array"
        };
    }

    // Validate instructor ID
    if (!instructorId) {
        return {
            isValid: false,
            message: "Unauthorized: Instructor ID not found"
        };
    }

    return {
        isValid: true,
        message: "Validation passed"
    };
};

export { addCourseValidation };