"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostController = void 0;
const domain_1 = require("../../domain");
class PostController {
    constructor(postService) {
        this.postService = postService;
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            console.error("Unhandled error:", error);
            return res.status(500).json({ message: "Something went very wrong" });
        };
        this.createPost = (req, res) => {
            const [error, createPostDto] = domain_1.CreateDTO.create(req.body);
            if (error) {
                return res.status(422).json({ message: error });
            }
            this.postService
                .createPost(createPostDto)
                .then((data) => {
                res.status(201).json(data);
            })
                .catch((error) => this.handleError(error, res));
        };
        this.findAllPost = (req, res) => {
            this.postService
                .findAllPost()
                .then((data) => {
                res.status(201).json(data);
            })
                .catch((error) => this.handleError(error, res));
        };
        this.findOnePost = (req, res) => {
            const { id } = req.params;
            this.postService
                .findOnePost(id)
                .then((data) => {
                res.status(201).json(data);
            })
                .catch((error) => this.handleError(error, res));
        };
        this.updatePost = (req, res) => {
            const { id } = req.params;
            const [error, updateProductDto] = domain_1.UpdateDTO.create(req.body);
            if (error)
                return res.status(422).json({ message: error });
            this.postService
                .updatePost(id, updateProductDto)
                .then((data) => {
                res.status(200).json(data);
            })
                .catch((error) => this.handleError(error, res));
        };
        this.deletePost = (req, res) => {
            const { id } = req.params;
            this.postService
                .deletePost(id)
                .then(() => {
                res.status(204).json(null);
            })
                .catch((error) => this.handleError(error, res));
        };
    }
}
exports.PostController = PostController;
