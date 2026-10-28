import { Request, Response } from "express";
import { BlogPost } from "../models/blog.model";
import User from "../models/user.model";
import { Instructor } from "../models/instructor.model";
import { Admin } from "../models/admin.model";

// Create blog post (admin or instructor only)
export const handleCreateBlogPost = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized"
            });
        }

        const { title, content, excerpt, coverImage, category, tags, readTime, published } = req.body;

        if (!title || !content || !excerpt || !category || !readTime) {
            return res.status(400).json({
                status: "failed",
                message: "Title, content, excerpt, category, and read time are required"
            });
        }

        // Check if user is admin or instructor
        const admin = await Admin.findById(userId);
        const instructor = await Instructor.findById(userId);
        const user = await User.findById(userId);

        if (!admin && !instructor) {
            return res.status(403).json({
                status: "failed",
                message: "Only admins and instructors can create blog posts"
            });
        }

        let authorName, authorEmail, authorRole, authorProfilePicture;

        if (admin) {
            authorName = admin.name;
            authorEmail = admin.email;
            authorRole = 'admin';
            authorProfilePicture = undefined;
        } else if (instructor) {
            authorName = instructor.name;
            authorEmail = instructor.email;
            authorRole = 'instructor';
            authorProfilePicture = instructor.profilePicture;
        } else {
            return res.status(403).json({
                status: "failed",
                message: "User not authorized"
            });
        }

        const newBlogPost = await BlogPost.create({
            title,
            content,
            excerpt,
            coverImage,
            category,
            author: userId,
            authorName,
            authorEmail,
            authorRole: authorRole as 'admin' | 'instructor',
            authorProfilePicture,
            tags: tags || [],
            readTime,
            published: published !== undefined ? published : false
        });

        res.status(201).json({
            status: "success",
            message: "Blog post created successfully",
            data: newBlogPost as any
        });
    } catch (error) {
        console.error("Error creating blog post:", error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

// Get all published blog posts
export const handleGetAllBlogPosts = async (req: Request, res: Response) => {
    try {
        const { category, author } = req.query;

        const filter: any = { published: true };

        if (category) {
            filter.category = category;
        }

        if (author) {
            filter.author = author;
        }

        const blogPosts = await BlogPost.find(filter)
            .populate('author', 'name email profilePicture')
            .sort({ createdAt: -1 });

        res.status(200).json({
            status: "success",
            message: "Blog posts fetched successfully",
            data: blogPosts as any
        });
    } catch (error) {
        console.error("Error fetching blog posts:", error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

// Get blog post by ID
export const handleGetBlogPostById = async (req: Request, res: Response) => {
    try {
        const { blogId } = req.params;

        const blogPost = await BlogPost.findById(blogId)
            .populate('author', 'name email profilePicture')
            .populate('likes.userId', 'name profilePicture')
            .populate('comments.userId', 'name profilePicture');

        if (!blogPost) {
            return res.status(404).json({
                status: "failed",
                message: "Blog post not found"
            });
        }

        // Increment view count
        blogPost.views = (blogPost.views || 0) + 1;
        await blogPost.save();

        res.status(200).json({
            status: "success",
            message: "Blog post fetched successfully",
            data: blogPost as any
        });
    } catch (error) {
        console.error("Error fetching blog post:", error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

// Get blog posts by author (admin/instructor dashboard)
export const handleGetBlogPostsByAuthor = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized"
            });
        }

        const blogPosts = await BlogPost.find({ author: userId })
            .sort({ createdAt: -1 });

        res.status(200).json({
            status: "success",
            message: "Author's blog posts fetched successfully",
            data: blogPosts as any
        });
    } catch (error) {
        console.error("Error fetching author's blog posts:", error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

// Update blog post
export const handleUpdateBlogPost = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { blogId } = req.params;
        const { title, content, excerpt, coverImage, category, tags, readTime, published } = req.body;

        if (!userId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized"
            });
        }

        const blogPost = await BlogPost.findById(blogId);

        if (!blogPost) {
            return res.status(404).json({
                status: "failed",
                message: "Blog post not found"
            });
        }

        // Check if user is the author
        if (blogPost.author.toString() !== userId) {
            return res.status(403).json({
                status: "failed",
                message: "You can only update your own blog posts"
            });
        }

        // Update fields
        if (title) blogPost.title = title;
        if (content) blogPost.content = content;
        if (excerpt) blogPost.excerpt = excerpt;
        if (coverImage !== undefined) blogPost.coverImage = coverImage;
        if (category) blogPost.category = category;
        if (tags) blogPost.tags = tags;
        if (readTime) blogPost.readTime = readTime;
        if (published !== undefined) blogPost.published = published;

        await blogPost.save();

        res.status(200).json({
            status: "success",
            message: "Blog post updated successfully",
            data: blogPost as any
        });
    } catch (error) {
        console.error("Error updating blog post:", error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

// Delete blog post
export const handleDeleteBlogPost = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { blogId } = req.params;

        if (!userId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized"
            });
        }

        const blogPost = await BlogPost.findById(blogId);

        if (!blogPost) {
            return res.status(404).json({
                status: "failed",
                message: "Blog post not found"
            });
        }

        // Check if user is the author
        if (blogPost.author.toString() !== userId) {
            return res.status(403).json({
                status: "failed",
                message: "You can only delete your own blog posts"
            });
        }

        await BlogPost.findByIdAndDelete(blogId);

        res.status(200).json({
            status: "success",
            message: "Blog post deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting blog post:", error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

// Like blog post
export const handleLikeBlogPost = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { blogId } = req.params;

        if (!userId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized"
            });
        }

        const blogPost = await BlogPost.findById(blogId);

        if (!blogPost) {
            return res.status(404).json({
                status: "failed",
                message: "Blog post not found"
            });
        }

        // Check if user already liked the post
        const alreadyLiked = blogPost.likes.some(like => like.userId && like.userId.toString() === userId);

        if (alreadyLiked) {
            // Remove like
            blogPost.likes = blogPost.likes.filter((like: any) => !like.userId || like.userId.toString() !== userId) as any;
        } else {
            // Add like
            blogPost.likes.push({
                userId: userId as any,
                likedAt: new Date()
            } as any);
        }

        await blogPost.save();

        res.status(200).json({
            status: "success",
            message: alreadyLiked ? "Like removed" : "Blog post liked",
            data: blogPost as any
        });
    } catch (error) {
        console.error("Error liking blog post:", error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

// Comment on blog post
export const handleCommentBlogPost = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { blogId } = req.params;
        const { comment } = req.body;

        if (!userId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized"
            });
        }

        if (!comment) {
            return res.status(400).json({
                status: "failed",
                message: "Comment is required"
            });
        }

        const blogPost = await BlogPost.findById(blogId);

        if (!blogPost) {
            return res.status(404).json({
                status: "failed",
                message: "Blog post not found"
            });
        }

        const user = await User.findById(userId) || await Instructor.findById(userId) || await Admin.findById(userId);

        if (!user) {
            return res.status(404).json({
                status: "failed",
                message: "User not found"
            });
        }

        // Add comment
        blogPost.comments.push({
            userId: userId as any,
            userName: user.name,
            comment,
            commentedAt: new Date()
        } as any);

        await blogPost.save();

        res.status(201).json({
            status: "success",
            message: "Comment added successfully",
            data: blogPost as any
        });
    } catch (error) {
        console.error("Error commenting on blog post:", error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};
