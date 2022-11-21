const express = require("express");
const cors = require("cors");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { reset } = require("nodemon");

//middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  // console.log(req.headers.authorization)
  const authHeader = req.headers.authorization;
//   console.log("Bearer", authHeader);
  if (!authHeader) {
    return res.status(401).send({message : "Unauthorized access 1"});
  }
  const token = authHeader.split(" ")[1];
//   console.log("Token : ",token)

  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(403).send("Forbidden access");
    }
    req.decoded = decoded;
    next();
  });
};

//port
const port = process.env.PORT || 5002;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.6ulnnbw.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const run = async () => {
  try {
    const appointmentOptionsCollection = client
      .db("doctorsPortal")
      .collection("appointmentOptions");

    const bookingCollection = client.db("doctorsPortal").collection("booking");
    const usersCollection = client.db("doctorsPortal").collection("users");

    // use aggregate to query multiple collection and then merge data
    app.get("/appointmentOptions", async (req, res) => {
      const date = req.query.date; //got the date from client
      //   console.log(date);

      const query = {};
      const options = await appointmentOptionsCollection.find(query).toArray();

      //get the bookings of the provided date.
      const bookingQuery = { appointmentDate: date };
      const alreadyBooked = await bookingCollection
        .find(bookingQuery)
        .toArray();

      options.forEach((option) => {
        const optionBooked = alreadyBooked.filter(
          (book) => book.treatment === option.name
        );

        const bookedSlots = optionBooked.map((book) => book.slot);

        const remainingSlots = option.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        option.slots = remainingSlots;
        // console.log(option.name, bookedSlots, remainingSlots.length);
      });
      res.send(options);
    });

    app.get("/booking", verifyJWT, async (req, res) => {
      const email = req.query.email;

      //adding this block of code because if someone tries to get the url from application tab and tries to find out what it contains, he'll get "forbidden access"

      const decodedEmail = req.decoded.email;
        if(email != decodedEmail){
            return res.status(403).send({message : "Forbidden access"})
        }
      const query = { email: email };
      const bookings = await bookingCollection.find(query).toArray();
      //   console.log(bookings);
      res.send(bookings);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.post("/booking", async (req, res) => {
      const booking = req.body;
      //   console.log(booking);
      const query = {
        email: booking.email,
        appointmentDate: booking.appointmentDate,
        treatment: booking.treatment,
      };

      const alreadyBooked = await bookingCollection.find(query).toArray();
      if (alreadyBooked.length) {
        const message = `You already have a booking on ${booking.appointmentDate}`;
        return res.send({ acknowledged: false, message });
      }

      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });



    //jwt
    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      //   console.log(user);
      //for the console.log, if the email from query isnt on db,  we'll get null
      if (user && user.email) {
        //if user found, we'll send the token and stuff
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
          expiresIn: "2d",
        });
        return res.send({ accessToken: token });
      }
      //if not, we'll send a status 403
      res.status(403).send({ accessToken: "" });
    });


    app.get('/users', async(req, res) => {
        const query = {}
        const users = await usersCollection.find(query).toArray()
        res.send(users)
    })


    app.get('/users/admin/:email', verifyJWT, async(req, res) => {
        const email = req.params.email;
        console.log(email);
        const query = {email : email}
        const user = await usersCollection.findOne(query)
        res.send({isAdmin : user?.role === 'admin'})
    })

    app.put('/users/admin/:id', verifyJWT, async(req, res) => {
        const decodedEmail = req.decoded.email;
        const query = {email : decodedEmail}
        const user = await usersCollection.findOne(query)
        if(user.role !== 'admin'){
            return res.status(403).send({message : "Forbidden access"})
        }
        const id = req.params.id;
        const filter = { _id : ObjectId(id)}
        const option = { upsert : true }
        const updatedDoc = {
            $set : {
                role : 'admin'
            }
        }
        const result = await usersCollection.updateOne(filter, updatedDoc, option)
        res.send(result)
    })

  } finally {
  }
};

run().catch();

app.get("/", async (req, res) => {
  res.send("Doctor's portal server is running");
});

app.listen(port, () => {
  console.log(`Doctor's portal running on ${port}`);
});
