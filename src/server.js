import express from 'express'
import cors from 'cors'
import session from 'express-session'
import MongoStore from 'connect-mongo'
import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb'

const app = express()
const uri = process.env.MONGODB_URI

app.use(express.json())
app.use(cors({ 
  origin: "http://localhost:5173", 
  credentials: true 
}))

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: uri }),
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}))

let db

const client = new MongoClient(uri)
client.connect().then(() => {
  db = client.db('testDatabase')
  console.log("mongodb connection success")
})


app.get('/', (req, res) => {
  res.send({ status: "hello there" })
})
// ini check auth, authentication atau autentikasi
app.get('/check-auth', (req, res) => {
  // kirim res. kalau kosong, kirim { loggedIn: false })
  res.send(req.session.user || { loggedIn: false })
})
app.post('/login', async (req, res) => {
  // define variabel
  const { user, pass } = req.body
  // nyari username
  const findUser = await db.collection('test_collection').findOne({ username: user })
  console.log(findUser)
  // jika ada user di db koleksi dan password yang user input sama kayak yang di db
  if (findUser && findUser.password === pass) {
    // maka tambahkan req.session.user = {} di object req dengan tanpa let / const
    req.session.user = { id: findUser._id, name: findUser.username }
    return res.json({ msg: "login ok", user: req.session.user })
  }
  res.status(401).json({ msg: "login gagal" })
})
app.post('/logout', (req, res) => {
  req.session.destroy()
  res.clearCookie('connect.sid')
  res.json({ msg: "sudah keluar" })
})
app.post('/signup', async (req, res) => {
  try {
    const { user, pass } = req.body
    const findUser = await db.collection('test_collection').findOne({ username: user })
    
    if (findUser) {
      return res.status(400).json({ msg: "username telah dipakai" })
    }
    
    await db.collection('test_collection').insertOne({ 
      username: user, 
      password: pass
    })
    res.status(201).json({ msg: "signup berhasil" })
    
  } catch (error) {
    console.error(error)
    res.status(500).json({ msg: "terjadi kesalahan" })
  }
})

//====================[ PEMINJAMAN ]====================\\
app.get('/api/get-data-pinjaman-buku', async (req, res) => {
  const findData = await db.collection('db-pinjaman-buku').find().toArray()
  res.send({ data: findData })
})
app.get('/api/me', async (req, res) => {
  res.send({ msg: req.session })
})
app.post('/api/save-new-pinjaman', async (req, res) => {
  const { namaPeminjam, namaBuku, jumlahPinjam, tanggalPinjam, tanggalKembali, isDikembalikan } = req.body;
  if (!namaPeminjam || !namaBuku || !jumlahPinjam) {
    return res.status(400).json({ msg: "Data tidak lengkap" });
  }
  try {
    const existing = await db.collection('db-pinjaman-buku').findOne({
      namaPeminjam,
      isDikembalikan: false
    });
    if (existing) {
      return res.status(400).json({ msg: "Anda masih memiliki buku yang belum dikembalikan" });
    }
    const result = await db.collection('db-pinjaman-buku').insertOne({
      namaPeminjam,
      namaBuku,
      jumlahPinjam: Number(jumlahPinjam),
      tanggalPinjam,
      tanggalKembali,
      isDikembalikan
    })
    res.status(201).json({ msg: 'Peminjaman berhasil dilakukan!' })
  } catch (error) {
    res.status(500).json({ msg: "Server error: " + error.message })
  }
})
app.delete('/api/delete-pinjaman/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.collection('db-pinjaman-buku').deleteOne({ 
      _id: new ObjectId(id) 
    });
    
    if (result.deletedCount === 1) {
      res.json({ msg: "Data berhasil dihapus" });
    } else {
      res.status(404).json({ msg: "data tidak ditemukan" });
    }
  } catch (error) {
    res.status(500).json({ msg: "gagal menghapus data" });
  }
});

//================[ BOOK LIST ]================
app.get('/api/get-book-list', async (req, res) => {
  try {
    const books = await db.collection('book_data').find().toArray()
    res.status(200).json({ data: books })
  } catch (e) {
    console.log('Terjadi error saat mengambil list buku : ' + e)
    res.status(500).json({ msg: "terjadi error pada server"})
  }
})
app.post('/api/delete-book-data/:id', async (req, res) => {
  const { id } = req.params
})
app.post('/api/push-book-list', async (req, res) => {
  try {
    const { imageUrl, name, title, description, uploader, genre, rate } = req.body
    const findBook = await db.collection("book_data").findOne({ title: title })
    if ( findBook ) return res.status(401).json({ msg: "sudah ada buku yang sama"})
    await db.collection("book_data").insertOne({
      imageUrl: imageUrl,
      name: name,
      title: title,
      description: description,
      uploader: uploader,
      genre: genre,
      rate: rate
    })
    res.status(201).json({ msg: "buku berhasil ditambahkan" })
  } catch (error) {
    console.log(error)
    res.status(500).json({ msg: "gagal menambah data buku" })
  }
})

//=============[ GENRE AVAILABLE ]=========
app.get('/api/get-avail-genre', async (req, res) => {
  res.send({ genre: ['sci-fi', 'educate', 'business', 'finance'] })
})

app.listen(3000, () => console.log("running on port 3000"))
