require('dotenv').config();
const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const assert = require('assert');
const RangeParser = require('range-parser');
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const _ = require("lodash");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
const OAuth2Client = require('google-auth-library');
const { rest } = require('lodash');
const aws = require('aws-sdk');

const app = express();


app.set('trust proxy', 1);

app.use(session({
cookie:{
    secure: true,
    maxAge:60000
       },
secret: process.env.SECRET,
saveUninitialized: true,
resave: false
}));

app.use(function(req,res,next){
if(!req.session){
    return next(new Error('Oh no')) //handle error
}
next() //otherwise continue
});

// let s3 = new aws.S3({
//   secret: process.env.SECRET,
//   clientID: process.env.CLIENT_ID,
//   clientSecret: process.env.CLIENT_SECRET
// });

//using and setting different packages
app.use(bodyParser.urlencoded({extended:true}));
app.set("view engine",ejs);
app.use(express.static(__dirname + '/public'));

//intializing passport and using passport.session()
app.use(passport.initialize());
app.use(passport.session());

var database = process.env.DATABASE;

//setting up mongodb
mongoose.connect(database,{useNewUrlParser: true, useUnifiedTopology: true,useFindAndModify:true});
mongoose.set("useCreateIndex",true);


//defining database schema
const reportSchema = new mongoose.Schema({
  userId:String,
  patientName:String,
  age:Number,
  doctorName:String,
  date:Date,
  prescription:String,
  PCOSpercentage:String,
  results:String
});
const messageSchema = new mongoose.Schema({
  senderId:String,
  senderName:String,
  messageHeading:String,
  messageContent:String, //this will contain the message by sender
  seenBool:Boolean //for cheking if user have seen the message
});

//database for blog page
const blogSchema = new mongoose.Schema({
  userId:{type:String,required:true}, //blogger's id
  userName:{type:String,required:true}, //blogger's name
  blogHeading:{type:String,required:true}, //blog's heading
  blogContent:{type:String,required:true}, //blog content
  blogLike:Number //for further devlopment
});

const patientSchema = new mongoose.Schema({
  isDoctor:Boolean,
  pictureURL:String,
  doctorID:String,
  certified:Boolean,
  username:{ type:String},
  user_id:{type:String},
  qualification:String,
  age:{type:Number,min:5,max:150},
  bloodGroup:String,
  gender:String,
  height:Number,
  weight:Number,
  email:String,
  address:String,
  contactNo:Number,
  hospitalName:String,
  message:[messageSchema], //array of messages sent to user
  reportDetails:[reportSchema], //array of report send by doctors
  blogs: [blogSchema],
  problemFaced:[{problemHeading:String,problem:String}],
  medicine:[{medName:{type:String,required:true},dateStart:Date,dateEnd:Date}],
  appointment:[{patientName:String,patientID:String,isPatient:Boolean}],
});


//using plugin of passport for login and Register
patientSchema.plugin(passportLocalMongoose);
// //patientSchema.plugin(findOrCreate);
// doctorSchema.plugin(passportLocalMongoose);

//creating User model and creating strategy
var User = new mongoose.model("User",patientSchema);
passport.use(User.createStrategy());

// // //creating User model and creating GoogleStrategy
// var Doctor = new mongoose.model("Doctor",patientSchema);
// passport.use(Doctor.createStrategy());

//creating Blog model
const PCOSBlog = new mongoose.model("PCOSBlog",blogSchema);

//creating message model
const Message = new mongoose.model("message",blogSchema);

//serialiizing and derseializing user ///////////////////////////////////////////////////////////////////////////////////////
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

//serializing and deserializing doctor account
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  Doctor.findById(id, function(err, user) {
    done(err, user);
  });
});
//serialiizing and derseializing user ///////////////////////////////////////////////////////////////////////////////////////


  /////////////////////////////////*********** Google Authentification ************//////////////////////////////////////
//
// var pictureURL = null;
// var docPictureURL = null;

passport.use('google',new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "https://sleepy-everglades-33959.herokuapp.com/auth/google/patient"
    // https://sleepy-everglades-33959.herokuapp.com/doctor/dashboard
  },
  function(accessToken, refreshToken, profile, done) {
    // pictureURL = profile._json.picture;
       User.findOne({ user_id: profile.id }, function (err, user) {  //changing googleId to username
         if (err) {
                return done(err);}
           if(!user)
           {
             const id = profile.id;
             const pictureURL = profile._json.picture;
             const name = profile.displayName;
             const newUser = User({isDoctor:false,username:name,user_id:id,pictureURL:pictureURL});
             newUser.save(function(err) {
                    if (err) console.log(err);
                    return done(err, newUser);});
         }
           else {
             return done(err, user);
           }
           });
  }));


app.get('/auth/google/patient',
  passport.authenticate('google', { failureRedirect: '/' }),
  function(req, res) {
      User.findOne({user_id:req.user.user_id},function (err,document) {
        if(document)
        {
          if(document.isDoctor === null || document.isDoctor === false)
          {
            res.redirect('/patient/dashboard');
          }
          else {
            res.redirect('/doctor/dashboard');
          }
        }
      });
  });


  ///////////////////////////////**********Doctor Authentification*********//////////////////////////////////////////////////////

  passport.use('google-doctor',new GoogleStrategy({
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "https://sleepy-everglades-33959.herokuapp.com/auth/google/doctor"
    },
    function(accessToken, refreshToken, profile, done) {

      // pictureURL = profile._json.picture;
         User.findOne({ user_id: profile.id }, function (err, user) {  //changing googleId to username
           if (err) {
                  return done(err);}
             if(!user)
             {
               const id = profile.id;
               const pictureURL = profile._json.picture;
               const name = profile.displayName;
               const newUser = User({isDoctor:true,certified:false,username:name,user_id:id,pictureURL:pictureURL});
               newUser.save(function(err) {
                      if (err) console.log(err);
                      return done(err, newUser);});
           }
             else {
               return done(err, user);
             }
             });
    }));

  app.get('/auth/google/doctor',
    passport.authenticate('google-doctor', { failureRedirect: '/' }),
    function(req, res) {
      User.findOne({user_id:req.user.user_id},function (err,document) {
        if(document)
        {
          if(document.isDoctor != null && document.isDoctor === true)
          {
            res.redirect('/doctor/dashboard');
          }
          else {
            res.redirect('/patient/dashboard');
          }
        }
    });
  });


  /////////////////////////////////*********** Google Authentification END************//////////////////////////////////////


//code for getting and posting on routes
app.get("/",function(req,res){
  res.render("HOMEindex.ejs");
});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] }));


app.get('/auth/googledoc',
  passport.authenticate('google-doctor', { scope: ['profile'] }));


app.get("/logout",function(req,res){
  req.logout();
  res.redirect("/");
});

// app.get("/register",function(req,res) {
//   res.render("register.ejs");
// })

app.get("/yogadiet",function(req,res){
  res.render("helpinfo.ejs");
});

app.get("/patient/dashboard",function(req,res){
  if(req.user)
  {
    var name = req.user.username;
    const userID = req.user.user_id;

    User.findOne({user_id:userID},function(err,user){
      var problemList = user.problemFaced;
      var medicineList = user.medicine;
      var messages = user.message;
      res.render("patient.ejs",
      {imageSource:user.pictureURL,userName:user.username,age:user.age,weight:user.weight,
        height:user.height,gender:user.gender,contactNo:user.contactNo,
      address:user.address,bloodGroup:user.bloodGroup,email:user.email,problemItems:problemList,
      medicineItems:medicineList});

  });
  }
  else {
    res.redirect("/");
  }

});


app.post("/patient/dashboard/one-time-inputs",function(req,res){
  const identity = req.user.user_id;
  const name = req.body.name;
  const age = req.body.age;
  const weight = req.body.weight;
  const height = req.body.height;
  const blood = req.body.blood;
  const number = req.body.number;
  const mail = req.body.mail;
  const jender = req.body.gender;
  const qualification = req.body.qualification;
  const add=req.body.add[0];

  User.updateOne({user_id:identity},
    {userName:name,age:age,bloodGroup:blood,email:mail,contactNo:number,
      gender:jender,address:add,weight:weight,height:height,qualification:qualification},
      function(err){
      console.log(err);
    });
  res.redirect("/patient/dashboard");
});


/////////////////////////////****** Patient Report **** Patient Problems ****** Patient Medicines ///////////////////////

app.post("/patient/dashboard/patientReport",function(req,res){

  const userID = req.user.user_id;
  User.findOneAndUpdate({user_id:userID}, { $set: { name: 'jason bourne' }}, {upsert:true}, function(event) {
      console.log(event);
    })
  });

app.post("/patient/dashboard/patientProblem",function(req,res){

  const userID = req.user.user_id;
  const heading = req.body.patientProblemHeading;
  const problem = req.body.patientProblemContent;
  User.updateOne({user_id:userID},
     { $push:{problemFaced:{problemHeading:heading,problem:problem}}},
    {upsert:true}, function(event) {
      res.redirect("/patient/dashboard");
    });
  });

  app.post("/patient/dashboard/patientProblem/delete", function(req, res) {
  const itemId = req.body.Checkbox;
  const userID = req.user.user_id;

  User.updateOne({user_id: userID},
    {$pull:{problemFaced:{_id:itemId}}},function(err) {
      console.log(err);
    });
    res.redirect("/patient/dashboard");
  });

app.post("/patient/dashboard/patientMedicines",function(req,res){

  const userID = req.user.user_id;
  var start = req.body.startDate;
  var end = req.body.stopDate;

  User.updateOne({user_id:userID},
     { $push: { medicine: {medName:req.body.patientMedicines,dateStart:start, dateEnd:end}}},
     {upsert:true}, function(err) {
      if(err){console.log(err);}
      else {
        res.redirect("/patient/dashboard");
      }
    });
  });

  app.post("/patient/dashboard/patientMedicine/delete", function(req, res) {
  const itemId = req.body.Checkbox;
  const userID = req.user.user_id;

  User.updateOne({user_id: userID},
    {$pull:{medicine:{_id:itemId}}},function(err) {
      if(err){console.log(err);}
    });
    res.redirect("/patient/dashboard");
  });

///////////????????????????????????????  Appointment Section   ?????????????????????????????????????////////////////////////////////////

app.get("/patient/appointment",function(req,res) {
  User.find({},function(err,doc) {
    res.render("doctorsCommunity.ejs",{doctorsList:doc});
  });
});

/////////////////////////////****** Patient Report **END** Patient Problems ****** Patient Medicines ///////////////////////

app.get("/patient/dashboard/selector",function (req,res) {
  if(req.user)
  {
    console.log("i am inside dashboard selector");
    var name = req.user.username;
    const userID = req.user.user_id;

    if(req.user.isDoctor === true)
    {
      res.redirect("/doctor/dashboard");
    }
    else {
      res.redirect("/patient/dashboard")
    }
  }
  else {
    res.redirect("/");
  }
})

/////////////////////////////****** Patient Report **** Patient Problems ****** Patient Medicines ///////////////////////


app.get("/doctor/dashboard",function(req,res){
  if(req.user)
  {
    var name = req.user.username;
    const userID = req.user.user_id;

    User.findOne({user_id:userID},function(err,user){
    res.render("doctor.ejs",{userName:name,doctorID:user.doctorID,gender:user.gender,
      qualification:user.qualification,age:user.age,address:user.address,email:user.email,
      hospitalName:user.hospitalName,contactNo:user.contactNo,
    patientAppointments:user.appointment,doctorPatients:user.appointment});
  });
  }
  else {
    res.redirect("/");
  }
});


app.post("/doctor/dashboard/one-time-inputs",function(req,res){
  const identity = req.user.user_id;
  const name = req.body.name;
  const age = req.body.age;
  const docId = req.body.DocID;
  const qualification = req.body.qualification;
  const hospitalName = req.body.hospital;
  const number = req.body.number;
  const mail = req.body.mail;
  const jender = req.body.gender;
  const add=req.body.location;

  User.updateOne({user_id:identity},
    {userName:name,age:age,doctorID:docId,email:mail,contactNo:number,
      gender:jender,address:add,hospitalName:hospitalName, qualification:qualification}
      ,function(err){
      console.log(err);
    });

  res.redirect("/doctor/dashboard");
});




/////////////////////////////******Appointment Section ********//////////////////////////////////////////

app.post("/patient/askAppointment",function(req,res) {
  var doctorID =  req.body.doctorId;
  if(req.user)
  {
    var name = req.user.username;
    const userID = req.user.user_id;

    User.updateOne({user_id: doctorID},
      {$push:{appointment:{patientName:name,patientID:userID,isPatient:false}}},function(err) {
        console.log(err);
      });
    res.redirect("/patient/appointment");
  }
});

app.post("/doctor/patientDetails",function(req,res) {
  var patientID = req.body.patient_id;
  if(req.body.buttonProfile)
  {
    User.findOne({user_id:patientID},function(err,patient) {
      if(!err){
        res.render("docPatient.ejs",{userName:patient.username,age:patient.age,contactNo:patient.contactNo,gender:patient.gender,email:patient.email,
        problemList:patient.problemFaced,medicineList:patient.medicine});
      }
      else {
        console.log(err);
      }
    });
  }
  else if (req.body.buttonConfirm) {
    var patientIdentity = req.body.patient_id;
    var name = req.user.username;
    const userID = req.user.user_id;
    User.findOne({user_id:userID},function(err,doctor) {
      if(!err){
         var index = 0;
          doctor.appointment.forEach((item, i) => {
            if(item.patientID==patientIdentity)
            {
              index = i;
              item.isPatient=true;
            }
            var ID = doctor.appointment[index]._id;
            doctor.appointment[index].isPatient = true;
            User.updateOne({user_id:userID,
              appointment:{$elemMatch:{patientID:patientIdentity}}},{$set:{"appointment.$.isPatient":true}},function(err) {
                if(err)console.log(err);
              });
          });
          res.redirect("/doctor/dashboard");
      }
      else {
        console.log(err);
        res.redirect("/doctor/dashboard");
      }
    });
  }
  else if (req.body.buttonDelete) {
    var patientIdentity = req.body.patient_id;
    var name = req.user.username;
    const userID = req.user.user_id;
      User.findOne({user_id:userID},function(err,doctor) {
        if(err){console.log(err)}
        else
          { var index = 0;
            doctor.appointment.forEach((item, i) => {
              if(item.patientID==patientIdentity)
              {
                index = i;
              }
              var ID = doctor.appointment[index]._id;
              User.updateOne({user_id:userID},{$pull:{appointment:{_id:ID}}},function(err) {
                if(err){console.log(err);}
              });
              res.redirect("/doctor/dashboard");
            });
          }
      });
    }
});

/////////////////////////////****** Blogs and Blog Page ********//////////////////////////////////////////////////////////


app.get("/blogpage",function(req,res){
  PCOSBlog.find({},function(err,blogs) {
    if(err){console.log(err);}
    else {
      res.render("blogpage.ejs",{blogList:blogs});
    }
  });


});

app.post("/blogpage",function(req,res) {
  const blogHeading = req.body.blogHeading;
  const blogContent = req.body.blogContent;

//checking if user is logged in or not

  if(req.user)
  {
    const userID = req.user.user_id ;
    const userName = req.user.username;


      PCOSBlog.findOne({blogHeading:blogHeading},function(err,doc) {
        if(err){console.log(err);}
        else {
          if(doc)
          {
              res.redirect("/blogpage");
          }
          else {
              const newBlog = new PCOSBlog({userId:userID,userName:userName,blogHeading:blogHeading,blogContent:blogContent});
              newBlog.save();
              User.updateOne({user_id:userID},
                 { $push: { blogs: newBlog}},{upsert:true}, function(err) {
                  if(err){console.log(err);}
                });
              res.redirect("/blogpage");
          }
        }
      });
  }
  else {
    res.redirect("/blogpage");
  }

});

app.get("/blogpage/:whatever", function(req, res) {
      var postId = req.params.whatever;
      PCOSBlog.findOne({_id:postId},function(err,document) {
        if(err){console.log(err);}
        else{
            res.render("post.ejs", {
            postUniqueId: postId,
            postHeading: document.blogHeading,
            postContent: document.blogContent,
            postWriter: document.userName});
         }
      });
  });

//post request for sending message to writer of the post
app.post("/blogpage/message",function(req,res) {
  var postId = req.body.postUniqueId;
  var messageTitle = req.body.messageTitle;
  var messageContent = req.body.messageContent;
  var userID = req.user.user_id ;
  var userName = req.user.username;
  console.log("Yahan message waali ma aa gya");
  PCOSBlog.findOne({_id:postId},function(err,doc) {
    if(err){console.log("Error ho gyi idhar mujhe nahi mila blog");}
    else {
      if(doc)
      {
        var blogWriterID = doc.userId;

        User.updateOne({user_id:blogWriterID},
           { $push: { message: {senderId:userID,senderName:userName,messageHeading:messageTitle,messageContent:messageContent}}},
           {upsert:true}, function(err) {
            if(err){res.redirect("/blogpage/"+postId);}
            else {
              console.log("Message cahal gya arram se");
            }
          });
        // Doctor.updateOne({user_id:blogWriterID},
        //    { $push: { message: {senderName:userName,messageHeading:messageTitle,messageContent:messageContent}}},{upsert:true}, function(err) {
        //     if(err){res.redirect("//blogpage/:whatever");}
        //   });
          res.redirect("/blogpage/"+postId);
        }
        else {
          console.log("Inhai document nahi mila postId se dhoodne par");
          res.redirect("/blogpage/"+postId);
        }
      }
    });
});

app.get("/index" , function(req,res){
  res.render("HOMEindex.ejs");
});

/////////////////////////////****** Blogs and Blog Page **END**//////////////////////////////////////////////////////////
let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
  app.listen(port, function(req, res) {
    console.log("The server is running on port 3000.");
  });
}
else {
  app.listen(port, function(req, res) {
    console.log("The server is running on port 3000.");
  });
}
