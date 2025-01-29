const { ref, required } = require("joi")
const mongoose = require("mongoose")

const commentSchema = new mongoose.Schema({
    postId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "post",
        required : true
    },
    userId:{
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        required : true
    },
    content:{
        type : String,
        required : true
    }
})

const Comment = mongoose.model("Comment" , commentSchema)

module.exports = Comment