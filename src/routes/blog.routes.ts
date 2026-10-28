import { Router } from "express";
import { ProtectMiddleWare } from "../middleware/protect-route";
import {
    handleCreateBlogPost,
    handleGetAllBlogPosts,
    handleGetBlogPostById,
    handleGetBlogPostsByAuthor,
    handleUpdateBlogPost,
    handleDeleteBlogPost,
    handleLikeBlogPost,
    handleCommentBlogPost
} from "../controllers/blog.controller";
import rateLimit from "express-rate-limit";

const blogRouter: Router = Router();

// Rate limiter for blog operations
const blogOperationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Limit each IP to 50 blog operations per 15 minutes
    message: {
        error: "Too many blog operations, please try again after 15 minutes"
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Create blog post (protected - admin/instructor only)
blogRouter.post("/create", ProtectMiddleWare, blogOperationLimiter, handleCreateBlogPost);

// Get all published blog posts (public)
blogRouter.get("/all", handleGetAllBlogPosts);

// Get blog posts by author (protected - for admin/instructor dashboard) - must come before /:blogId
blogRouter.get("/author/my-posts", ProtectMiddleWare, handleGetBlogPostsByAuthor);

// Get blog post by ID (public)
blogRouter.get("/:blogId", handleGetBlogPostById);

// Update blog post (protected)
blogRouter.put("/:blogId", ProtectMiddleWare, blogOperationLimiter, handleUpdateBlogPost);

// Delete blog post (protected)
blogRouter.delete("/:blogId", ProtectMiddleWare, blogOperationLimiter, handleDeleteBlogPost);

// Like blog post (protected)
blogRouter.post("/:blogId/like", ProtectMiddleWare, blogOperationLimiter, handleLikeBlogPost);

// Comment on blog post (protected)
blogRouter.post("/:blogId/comment", ProtectMiddleWare, blogOperationLimiter, handleCommentBlogPost);

export default blogRouter;
