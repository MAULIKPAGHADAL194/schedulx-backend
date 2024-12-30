const { SocialMedia, User, Post } = require("../models/index.js");

const SocialmediaGets = async (req, res) => {
    try {
        const { filter } = req.query;

        const findSocialMedia = await SocialMedia.find({ userId: req.user._id }).select('-createdBy -updatedAt -__v -lastModifiedBy -accessToken -accessSecret');

        const includePosts = filter === 'posts';

        const socialMediaWithPosts = await Promise.all(
            findSocialMedia.map(async (item) => {
                const socialMediaObj = item.toObject();
                if (includePosts) {
                    const findPosts = await Post.find({
                        $or: [
                            { 'platformSpecific.instagram.socialMediaId': item._id },
                            { 'platformSpecific.xtwitter.socialMediaId': item._id },
                            { 'platformSpecific.pinterest.socialMediaId': item._id },
                            { 'platformSpecific.linkedin.socialMediaId': item._id }
                        ]
                    });
                    return {
                        ...socialMediaObj,
                        posts: findPosts
                    };
                }
                return socialMediaObj;
            })
        );

        return res.status(200).json({
            success: true,
            count: socialMediaWithPosts.length,
            data: socialMediaWithPosts
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

const SocialmediaGet = async (req, res) => {
    try {
        let { id } = req.params;

        const { filter } = req.query;

        const includePosts = filter === 'post';

        const findUser = await User.findById(req.user._id);

        let findSocialMedia = await SocialMedia.find({ _id: id, userId: findUser._id }).select('-createdBy -updatedAt -__v -lastModifiedBy -accessToken -accessSecret');

        if (!findSocialMedia) {
            return res.status(400).json({ success: false, message: "The Social Media ID data does not exist." });
        }

        if (includePosts) {
            const findPosts = await Post.find({
                $or: [
                    { 'platformSpecific.instagram.socialMediaId': findSocialMedia._id },
                    { 'platformSpecific.xtwitter.socialMediaId': findSocialMedia._id },
                    { 'platformSpecific.pinterest.socialMediaId': findSocialMedia._id },
                    { 'platformSpecific.linkedin.socialMediaId': findSocialMedia._id }
                ]
            });
            return res.status(200).json({ success: true, data: { ...findSocialMedia.toObject(), posts: findPosts } });
        }

        return res.status(200).json({ success: true, data: findSocialMedia });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}

const SocialmediaDelete = async (req, res) => {
    try {
        let { id } = req.params;
        const findUser = await User.findById(req.user._id);

        console.log("findUser", findUser);
        const findSocialMedia = await SocialMedia.findOne({ _id: id, userId: findUser._id });

        console.log("findSocialMedia", findSocialMedia);

        if (!findSocialMedia) {
            return res.status(400).json({ success: false, message: "The Social Media ID data does not exist." });
        }

        const objectId = new mongoose.Types.ObjectId(id);

        const data = await Post.find(
            {
                $or: [
                    { "platformSpecific.xtwitter.socialMediaId": objectId },
                    { "platformSpecific.pinterest.socialMediaId": objectId },
                    { "platformSpecific.linkedin.socialMediaId": objectId }
                ]
            }
        )

        console.log(data);

        const deletepost = await Post.deleteMany(
            {
                $or: [
                    { "platformSpecific.xtwitter.socialMediaId": objectId },
                    { "platformSpecific.pinterest.socialMediaId": objectId },
                    { "platformSpecific.linkedin.socialMediaId": objectId }
                ]
            }
        )
        console.log(deletepost);

        await SocialMedia.findByIdAndDelete(id);
        return res.status(200).json({ success: true, message: `This ID ${findSocialMedia._id} Platform Name ${findSocialMedia.platformName} has been deleted successfully From ${findSocialMedia.userId} Account` });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}

module.exports = { SocialmediaGets, SocialmediaGet, SocialmediaDelete };