const express = require("express");
const app = express();
const bodyParser = require("body-parser");

const cors = require("cors");
const shortid = require("shortid");
const mongoose = require("mongoose");
//connect mongoDB using given URL in the .env file
mongoose.connect(process.env.MLAB_URI, { useNewUrlParser: true, useUnifiedTopology: true});

app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

//Users schema
var Users = new mongoose.Schema({
  username: {
    type: String, 
    required: true,
    unique: true,
    maxlength: [20, 'username too long']
  },
  _id: {
    type: String,
    index: true,
    default: shortid.generate
  },
  fitnessData: Array
});
var UsernameAndId = mongoose.model("UsernameAndId", Users);

//Add a new user
app.post("/api/exercise/new-user", (req, res) => {
  let tempId = shortid.generate();
  let data = { username: req.body.username, _id: tempId, fitnessData: Array };
  UsernameAndId.find({ username: data.username }, (err, docs) => {
    if (err) {
      res.send("Checking you username failed. Try again?");
    } else {
      if (docs.length == 0) {
        let saveUserNameAndId = new UsernameAndId(data);
        saveUserNameAndId.save(err => {
          if (err) {
            res.send("The Username and UserId could not be saved");
          }
          res.json(data);
        });
      } else {
        res.send("username already taken");
      }
    }
  });
});
//Exercise schema
var Exercises = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    maxlength: [20, 'description too long']
  },
  duration: {
    type: Number,
    required: true,
    min: [1, 'duration too short']
  },
  date: {
    type: Date,
    default: Date.now
  },
  username: String,
  userId: {
    type: String,
    ref: 'Users',
    index: true
  }
});
var UserFitnessData = mongoose.model("UserFitnessData", Exercises);

//Get all users object
app.get("/api/exercise/users", (req, res, next) => {
  UsernameAndId.find({}, (err, data) => {
    res.json(data);
  });
});

//Add a new exercise for a user
app.post("/api/exercise/add", (req, res, next) => {
  UsernameAndId.findById(req.body.userId, (err, user) => {
    if (err) return next(err);
    if (!user) {
      return next({
        status: 400,
        message: "unknown _id"
      });
    }
    const exercise = new UserFitnessData(req.body);
    exercise.username = user.username;
    exercise.save((err, savedExercise) => {
      if (err) return next(err);
      savedExercise = savedExercise.toObject();
      delete savedExercise.__v;
      savedExercise._id = savedExercise.userId;
      delete savedExercise.userId;
      savedExercise.date = new Date(savedExercise.date).toDateString();
      res.json(savedExercise);
    });
  });
});

//Get exercise logs with count and date functions
app.get("/api/exercise/log", (req, res, next) => {
  const from = new Date(req.query.from)
  const to = new Date(req.query.to)
  console.log(req.query.userId)
  console.log(from,to)
  UsernameAndId.findById(req.query.userId, (err, user) => {
    if (err) return next(err)
    if (!user) {
      return next({ status: 400, message: "unknown userId" });
    }
    //console.log(user);
    UserFitnessData.find({
      userId: req.query.userId,
      date: {
        $lt: to != "Invalid Date" ? to.getTime() : Date.now(),
        $gt: from != "Invalid Date" ? from.getTime() : 0
      }
    })
      .sort("-date")
      .limit(parseInt(req.query.limit))
      .exec((err, exercises) => {
        if (err) return next(err)
        const data = {
          _id: req.query.userId,
          username: user.username,
          from: from != "Invalid Date" ? from.toDateString() : undefined,
          to: to != "Invalid Date" ? to.toDateString() : undefined,
          log: exercises.map(e => ({
            description: e.description,
            duration: e.duration,
            date: e.date.toDateString()
          })),
          count: exercises.length
        };
        res.send(data)
      });
  });
});

//Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: "not found" });
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || "Internal Server Error";
  }
  res
    .status(errCode)
    .type("txt")
    .send(errMessage);
});
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
