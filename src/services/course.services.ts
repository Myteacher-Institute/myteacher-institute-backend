const addCourseValidation = (payload: { courseName?: string; description?: string; category?: string; chapters?: any[]; courseVideos?: any[]; courseRequirements?: any[]; price?: number; duration?: number; certificate?: string; programmingCodes?: any[]; assets?: any[]; quizzes?: any[] }, instructorId?: string) => {
    const { courseName, description, category, chapters, courseVideos, courseRequirements, price, duration, certificate, programmingCodes, assets, quizzes } = payload;

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

    if (!category) {
        return {
            isValid: false,
            message: "Category is required"
        };
    }

    const validCategories = ['Web Development', 'Data Science', 'Design', 'Business'];
    if (!validCategories.includes(category)) {
        return {
            isValid: false,
            message: "Invalid category. Must be one of: Web Development, Data Science, Design, Business"
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

    // Validate chapters structure
    if (chapters !== undefined) {
        if (!Array.isArray(chapters)) {
            return {
                isValid: false,
                message: "chapters must be an array"
            };
        }

        for (const chapter of chapters) {
            if (!chapter || typeof chapter !== 'object') {
                return {
                    isValid: false,
                    message: "Each chapter must be an object"
                };
            }

            if (chapter.title !== undefined && typeof chapter.title !== 'string') {
                return {
                    isValid: false,
                    message: "Each chapter title must be a string"
                };
            }

            if (chapter.videos !== undefined && !Array.isArray(chapter.videos)) {
                return {
                    isValid: false,
                    message: "Chapter videos must be an array"
                };
            }

            if (chapter.programmingCodes !== undefined && !Array.isArray(chapter.programmingCodes)) {
                return {
                    isValid: false,
                    message: "Chapter programmingCodes must be an array"
                };
            }

            if (chapter.assets !== undefined && !Array.isArray(chapter.assets)) {
                return {
                    isValid: false,
                    message: "Chapter assets must be an array"
                };
            }

            if (chapter.quizzes !== undefined && !Array.isArray(chapter.quizzes)) {
                return {
                    isValid: false,
                    message: "Chapter quizzes must be an array"
                };
            }

            for (const video of chapter.videos || []) {
                if (video && !video.videoUrl) {
                    return {
                        isValid: false,
                        message: "Each chapter video must have a videoUrl"
                    };
                }
            }
        }
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