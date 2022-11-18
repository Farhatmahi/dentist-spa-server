const express = require("express");
const cors = require("cors");
const app = express();
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

//middleware
app.use(cors());
app.use(express.json());

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

    //use aggregate to query multiple collection and then merge data
    app.get("/appointmentOptions", async (req, res) => {
      const date = req.query.date; //got the date from client
      console.log(date);
      
      const query = {};
      const options = await appointmentOptionsCollection.find(query).toArray();

      //get the bookings of the provided date.
      const bookingQuery = { appointmentDate: date }; //get the bookings of the provided date.
      const alreadyBooked = await bookingCollection
        .find(bookingQuery)
        .toArray();

      options.forEach((option) => {
        const optionBooked = alreadyBooked.filter(
          (book) => book.treatment === option.name
        );
        const bookedSlots = optionBooked.map((book) => book.slot);
        const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot))
        option.slots = remainingSlots
        console.log(option.name, bookedSlots, remainingSlots.length);
      });
      res.send(options);

      app.post("/booking", async (req, res) => {
        const booking = req.body;
        console.log(booking);
        const result = await bookingCollection.insertOne(booking);
        res.send(result);
      });
    });
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
