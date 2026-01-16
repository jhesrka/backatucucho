"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostRoutes = void 0;
const express_1 = require("express");
const controller_1 = require("./controller");
const post_service_1 = require("../services/post.service");
const user_service_1 = require("../services/user.service");
const email_service_1 = require("../services/email.service");
const config_1 = require("../../config");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
class PostRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const emailService = new email_service_1.EmailService(config_1.envs.MAILER_SERVICE, config_1.envs.MAILER_EMAIL, config_1.envs.MAILER_SECRET_KEY, config_1.envs.SEND_EMAIL);
        const userService = new user_service_1.UserService(emailService);
        const postService = new post_service_1.PostService(userService);
        const postController = new controller_1.PostController(postService);
        router.get("/", postController.findAllPost);
        router.use(auth_middleware_1.AuthMiddleware.protect);
        router.post("/", postController.createPost);
        router.get("/:id", postController.findOnePost);
        router.patch("/:id", postController.updatePost);
        router.delete("/:id", postController.deletePost);
        return router;
    }
}
exports.PostRoutes = PostRoutes;
