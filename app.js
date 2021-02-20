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
//const findOrCreate = require('mongoose-findorcreate');
const OAuth2Client = require('google-auth-library');
const { rest } = require('lodash');


const app = express();

//using session for creating session which helps in making cookies
// app.use(session({
//   secret:process.env.SECRET,
//   resave:false,
//   saveUninitialized:false
// })) ;

app.set('trust proxy', 1);

app.use(session({
// cookie:{
//     secure: true,
//     maxAge:60000
//        },
secret: process.env.SECRET,
saveUninitialized: true,
resave: false
}));

// app.use(function(req,res,next){
// if(!req.session){
//     return next(new Error('Oh no')) //handle error
// }
// next() //otherwise continue
// });


//using and setting different packages
app.use(bodyParser.urlencoded({extended:true}));
app.set("view engine",ejs);
app.use(express.static(__dirname + '/public'));

//intializing passport and using passport.session()
app.use(passport.initialize());
app.use(passport.session());

//setting up mongodb
mongoose.connect("mongodb://localhost:27017/pcosData",{useNewUrlParser: true, useUnifiedTopology: true,useFindAndModify:true});
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
  username:{ type:String},
  user_id:{type:String},
  age:{type:Number,min:5,max:150},
  gender:String,
  height:Number,
  weight:Number,
  email:String,
  address:String,
  contactNo:Number,
  message:[messageSchema], //array of messages sent to user
  reportDetails:[reportSchema], //array of report send by doctors
  blogs: [blogSchema],
  problemFaced:[{problemHeading:String,problem:String}],
  medicine:[{medName:{type:String,required:true},dateStart:Date,dateEnd:Date}]
});
const doctorSchema = new mongoose.Schema({
  certified:Boolean,
  username:{ type:String, required:true},
  user_id:{type:String},
  age:{type:Number,min:8,max:90},
  gender:String,
  email:String,
  address:String,
  contactNo:Number,
  blogs: [blogSchema],
  message:[messageSchema], //array of messages sent to user
  reportDetails:[reportSchema], //array of report send by doctors
});



const oneTime = new mongoose.Schema({
  username:{ type:String},
  user_id:{type:String},
  age:{type:Number,min:5,max:150},
  gender:String,
  height:Number,
  weight:Number,
  email:String,
  address:String,
  contactNo:Number,
  bloodGroup:String,
  made:0
});

const onetimeDoc = new mongoose.Schema({
  username:{ type:String},
  user_id:{type:String},
  age:{type:Number,min:5,max:150},
  gender:String,
  docId:String,
  qualification:String,
  email:String,
  contactNo:Number ,
  location:String,
  hospital:String,
  made:0
});



var docArray=[];

const otui = new mongoose.model('Information-of-user',oneTime);


const otd = new mongoose.model('Information-of-doctor',onetimeDoc);


//using plugin of passport for login and Register
patientSchema.plugin(passportLocalMongoose);
//patientSchema.plugin(findOrCreate);
doctorSchema.plugin(passportLocalMongoose);

//creating User model and creating strategy
const User = new mongoose.model("User",patientSchema);
passport.use(User.createStrategy());

// //creating User model and creating GoogleStrategy
const Doctor = new mongoose.model("Doctor",doctorSchema);
passport.use(Doctor.createStrategy());

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
// Use the GoogleStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, and Google
//   profile), and invoke a callback with a user object.
var pictureURL = null;
var docPictureURL = null;

passport.use('google',new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/patient"
  },
  function(accessToken, refreshToken, profile, done) {
    console.log(profile);
    pictureURL = profile._json.picture;
       User.findOne({ user_id: profile.id }, function (err, user) {  //changing googleId to username
         if (err) {
                return done(err);}
           if(!user)
           {
             const id = profile.id;
             const name = profile.displayName;
             const newUser = User({username:name,user_id:id,age:21});
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
  passport.authenticate('google', { failureRedirect: '/home' }),
  function(req, res) {
    res.redirect('/patient/dashboard');
  });


  ///////////////////////////////**********Doctor Authentification*********//////////////////////////////////////////////////////

  passport.use('google-doctor',new GoogleStrategy({
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/doctor"
    },
    function(accessToken, refreshToken, profile, done) {
      console.log(profile);
      pictureURL = profile._json.picture;
         Doctor.findOne({ user_id: profile.id }, function (err, user) {  //changing googleId to username
           if (err) {
                  return done(err);}
             if(!user)
             {
               const id = profile.id;
               const name = profile.displayName;
               const newUser = User({username:name,user_id:id});
               newUser.save(function(err) {
                      if (err) console.log(err);
                      return done(err, newUser);});
           }
             else {
               return done(err, user);
             }
             });
    }));

  // GET /auth/google/callback
  //   Use passport.authenticate() as route middleware to authenticate the
  //   request.  If authentication fails, the user will be redirected back to the
  //   login page.  Otherwise, the primary route function function will be called,
  //   which, in this example, will redirect the user to the home page.
  app.get('/auth/google/doctor',
    passport.authenticate('google-doctor', { failureRedirect: '/home' }),
    function(req, res) {
      res.redirect('/doctor/dashboard');
    });
  /////////////////////////////////*********** Google Authentification END************//////////////////////////////////////


//code for getting and posting on routes
app.get("/home",function(req,res){
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
})

app.get("/patient/dashboard",function(req,res){
  if(req.user)
  {
    var name = req.user.username;
    const userID = req.user.user_id;
    console.log("Hello");

    var naam ="";
    var age,weight,height,blood,number,gender,mail,make=0,address;

    otui.find({user_id:userID},function(err,docs)
    {
      if(docs[0])
      {
        naam=docs[0].username;
        age = docs[0].age;
        weight=docs[0].weight;
        height=docs[0].height;
        blood=docs[0].bloodGroup;
        number=docs[0].contactNo;
        gender=docs[0].gender;
        mail=docs[0].email;
        make=docs[0].made;
        address=docs[0].address;
      }
    });

    if(naam!="")
    {
      name=naam;
    }
    User.findOne({user_id:userID},function(err,user){
      var problemList = user.problemFaced;
      var medicineList = user.medicine;
      console.log("Hello");
      var messages = user.message;
      res.render("patient.ejs",
      {userName:naam,Age:age,Weight:weight,Height:height,Blood:blood,No:number,G:gender,Mail:mail,Address:address,Make:make,problemItems:problemList,medicineItems:medicineList,imageRoute:pictureURL,messageList:messages,docTape:docArray});
    //   res.render("patient.ejs",{userName:name,problemItems:problemList,medicineItems:medicineList,imageRoute:pictureURL,messageList:messages});
    // });
  });
  }
  else {
    res.redirect("/home");
  }

});

// app.get("/doctor/dashboard",function(req,res) {
//   res.render("doctor.ejs");
// })


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
  const add=req.body.add[0];
  var top = new otui({
    username:name,
    user_id:identity,
    age:age,
    gender:jender,
    height:height,
    weight:weight,
    email:mail,
    address:add,
    contactNo:number,
    bloodGroup:blood,
    made:1
  });
  top.save();
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

///////////????????????????????????????         Appointment Section   ?????????????????????????????????????////////////////////////////////////

app.get("/patient/appointment",function(req,res) {
  otd.find({},function(err,doc) {
    res.render("doctorsCommunity.ejs",{doctorsList:doc});
  });
  // Doctor.find({},function(err,docs) {
  //   res.render("doctorsCommunity.ejs",{doctorsList:docs});
  // })
})

app.post("/patient/appointment/select",function(req,res){

    const userID = req.user.user_id;
     otd.find({userID:user_id},function(err,user)
     {
       var temp;
       user.forEach(element => {
         temp={
           name:element.username,
           user_id:element_user_id,
           qualification:element.qualification,
           hospital:element.hospital
         }
       });
       docArray.push(temp);
     })
     res.redirect("/patient/dashboard");
});


/////////////////////////////****** Patient Report **END** Patient Problems ****** Patient Medicines ///////////////////////




/////////////////////////////****** Patient Report **** Patient Problems ****** Patient Medicines ///////////////////////


app.get("/doctor/dashboard",function(req,res){
  if(req.user)
  {
    var name = req.user.username;
    const userID = req.user.user_id;

    var naam ="";
    var docId,umr,qualification,hospital,number,gender,mail,make=0,location;

    otd.find({user_id:userID},function(err,docs)
    {
      if(docs[0])
      {
        naam=docs[0].username;
        umr = docs[0].age;
        docId=docs[0].docId;
        qualification=docs[0].qualification;
        hospital=docs[0].hospital;
        number=docs[0].contactNo;
        gender=docs[0].gender;
        mail=docs[0].email;
        make=docs[0].made;
        location=docs[0].location
      }
    });
    otd.findOne({user_id:userID},function(err,user){
    res.render("doctor.ejs",{userName:naam,Age:umr,Identity:docId,Q:qualification,H:hospital,No:number,G:gender,Mail:mail,L:location,Make:make});
  });
  }
  else {
    res.redirect("/home");
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
  var top = new otd({
    username:name,
    user_id:identity,
    age:age,
    gender:jender,
    qualification:qualification,
    docId:docId,
    email:mail,
    location:add,
    contactNo:number,
    hospital:hospitalName,
    made:1
  });
  top.save();
  res.redirect("/doctor/dashboard");
});


app.post("/selected-doctor",function(req,res){
  var Docidentity = req.body.button;
  var patientidentity = req.user.user_id;
  otd.find({user_id:identity},function(err,docs){

  })
})

app.get("/blogpage",function(req,res){
  res.render("blogpage.ejs");
})


/////////////////////////////****** Blogs and Blog Page ********//////////////////////////////////////////////////////////


app.get("/home/blogpage",function(req,res){
  PCOSBlog.find({},function(err,blogs) {
    if(err){console.log(err);}
    else {
      res.render("blogpage.ejs",{blogList:blogs});
    }
  });
});

app.post("/home/blogpage",function(req,res) {
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
              res.redirect("/home/blogpage");
          }
          else {
              const newBlog = new PCOSBlog({userId:userID,userName:userName,blogHeading:blogHeading,blogContent:blogContent});
              newBlog.save();
              User.updateOne({user_id:userID},
                 { $push: { blogs: newBlog}},{upsert:true}, function(err) {
                  if(err){console.log(err);}
                });
              res.redirect("/home/blogpage");
          }
        }
      });
  }
  else {
    res.redirect("/home/blogpage");
  }

});

app.get("/home/blogpage/:whatever", function(req, res) {
      var postId = req.params.whatever;
      PCOSBlog.findOne({_id:postId},function(err,document) {
        if(err){console.log(err);}
        else{
            res.render("post.ejs", {
            postUniqueId: postId,
            postHeading: document.blogHeading,
            postContent: document.blogContent,
            postWriter: document.userName });
         }
      });
  });

//post request for sending message to writer of the post
app.post("/home/blogpage/message",function(req,res) {
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
        console.log(blogWriterID);
        User.updateOne({user_id:blogWriterID},
           { $push: { message: {senderId:userID,senderName:userName,messageHeading:messageTitle,messageContent:messageContent}}},
           {upsert:true}, function(err) {
            if(err){res.redirect("/home/blogpage/"+postId);}
            else {
              console.log("Message cahal gya arram se");
            }
          });
        // Doctor.updateOne({user_id:blogWriterID},
        //    { $push: { message: {senderName:userName,messageHeading:messageTitle,messageContent:messageContent}}},{upsert:true}, function(err) {
        //     if(err){res.redirect("/home/blogpage/:whatever");}
        //   });
          res.redirect("/home/blogpage/"+postId);
        }
        else {
          console.log("Inhai document nahi mila postId se dhoodne par");
          res.redirect("/home/blogpage/"+postId);
        }
      }
    });
});

app.get("/HOMEindex" , function(req,res){
  res.render("HOMEindex.ejs");
});

app.get("/docPatient", function(req,res){
  res.render("docPatient.ejs");
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
