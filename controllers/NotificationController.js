const Notification = require("../models/Notification")

const createNotification = async (req , res) =>{
    try{
        let{
            message,
            status,
            type
        } = req.body

        const detail = await Notification.create({
            userId : req.user._id,
            message,
            status,
            type
        })

        await detail.save()
        res.status(500).json({success : false , data : detail})
    }catch(error){
        res.status(500).json({success : false , error : error.message})
    }
}

const allNotification = async (req , res) =>{
    try{
        const detail = await Notification.find()
        res.status(200).json({success : true , data : detail})
    }catch(error){
        res.status(500).json({success : false , error : error.message})
    }
}


const singleNotification = async (req , res) =>{
    try{
        let {id} = req.params
        const detail = await Notification.findById(id)
        res.status(200).json({success : true , data : detail})
    }catch(error){
        res.status(500).json({success : false , error : error.message})
    }
}

const updateNotification = async (req , res) =>{
    try{
        let {id} = req.params

        const detail = await Notification.findByIdAndUpdate(id , req.body , {new : true})
        res.status(200).json({success : true , data : detail})
    }catch(error){
        res.status(500).json({success : false , error : error.message})
    }
}

const deleteNotification = async (req , res) =>{
    try{
        let {id} = req.params
        const detail = await Notification.findByIdAndDelete(id)
        res.status(200).json({success : true , data : detail})
    }catch(error){
        res.status(500).json({success : false , error : error.message})
    }
}

module.exports = {createNotification , allNotification , singleNotification , updateNotification , deleteNotification}