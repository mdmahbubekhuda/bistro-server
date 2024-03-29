const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
require('dotenv').config()


const app = express()
const port = process.env.PORT || 5000

// middleware
app.use(express.json())
app.use(cors({
    origin: ['https://bistro-1c533.web.app'],
    credentials: true
}))
app.use(cookieParser())

// custom middlewares
const logger = (req, res, next) => {
    console.log(req.method, req.url)
    next()
}

// mongoDB
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.slhzfxc.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();


        // jwt - verify token middleware
        const verifiedToken = (req, res, next) => {
            const token = req?.cookies?.['access-token']
            if (!token) return res.status(401).send({ message: 'unauthorized access' })
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) return res.status(401).send({ message: 'unauthorized access' })
                req.decoded = decoded
                next()
            })
        }

        // jwt - create access-token
        app.post('/jwt', (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.cookie('access-token', token, { httpOnly: true, secure: true, sameSite: 'none' }).send({ success: true })
        })

        // jwt - remove access token
        app.post('/jwt/remove', (req, res) => {
            res.clearCookie('access-token', { maxAge: 0 }).send({ success: true })
        })

        // users collection
        const userCollection = client.db('bistroDB').collection('users')

        // verify admin middleware *** must use after verifiedToken ***
        const verifiedAdmin = async (req, res, next) => {
            const secretMail = req.decoded.userEmail
            const query = { email: secretMail }
            const user = await userCollection.findOne(query)
            const isAdmin = user?.role === 'admin'
            if (!isAdmin) return res.status(403).send({ message: 'forbidden access' })
            next()
        }

        // check admin role - (admin)
        app.get('/users/admin', verifiedToken, async (req, res) => {
            // validate token email with logged user email
            const email = req.query?.email
            if (email !== req.decoded.userEmail) return res.status(403).send({ message: 'forbidden access' })

            // check user role for admin
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const admin = user?.role === "admin"

            res.send({ admin })
        })

        // load all users
        app.get('/users', verifiedToken, verifiedAdmin, async (req, res) => {
            const result = await userCollection.find().toArray()
            res.send(result)
        })


        app.post('/users', async (req, res) => {
            const user = req.body
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query)
            if (existingUser) return res.send({ message: 'user already exist', userExist: 1 })
            const result = await userCollection.insertOne(user)
            res.send(result)
        })

        app.patch('/users/admin/:id', verifiedToken, verifiedAdmin, async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        app.delete('/users/:id', verifiedToken, verifiedAdmin, async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query)
            res.send(result)
        })

        // cart
        const cartCollection = client.db("bistroDB").collection('carts')

        app.get('/carts', async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const result = await cartCollection.find(query).toArray()
            res.send(result)
        })

        app.post('/carts', async (req, res) => {
            const cartItem = req.body
            const result = await cartCollection.insertOne(cartItem)
            res.send(result)
        })

        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await cartCollection.deleteOne(query)
            res.send(result)
        })


        // menu
        const menuCollection = client.db("bistroDB").collection("menu");

        app.get('/menu', async (req, res) => {
            const result = await menuCollection.find().toArray()
            res.send(result)
        })

        app.post('/menu', verifiedToken, verifiedAdmin, async (req, res) => {
            const itemInfo = req.body
            const result = await menuCollection.insertOne(itemInfo)
            res.send(result)
        })

        app.patch('/menu/:id', verifiedToken, verifiedAdmin, async (req, res) => {
            const id = req.params.id
            const doc = req.body
            const filter = { _id: new ObjectId(id) }
            const updateDoc = { $set: doc }
            const result = await menuCollection.updateOne(filter, updateDoc)
            res.send(result)
        })

        app.delete('/menu/:id', verifiedToken, verifiedAdmin, async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await menuCollection.deleteOne(query)
            res.send(result)
        })

        // review
        const reviewsCollection = client.db("bistroDB").collection("reviews");

        app.get('/reviews', async (req, res) => {
            const result = await reviewsCollection.find().toArray()
            res.send(result)
        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('bistro-server running')
})


app.listen(port, () => {
    console.log(`bistro-server running on ${port}`)
})