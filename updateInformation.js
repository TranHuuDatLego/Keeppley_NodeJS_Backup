const express = require('express');
const router = express.Router();
const conn = require('./connectDB');

router.post('/update-information', (req, res) => {
    const { userID, bio, birthday, country, phone } = req.body;
    
    const sql = "UPDATE User SET bio = ?, birthday = ?, country = ?, phone = ? WHERE userID = ?";
    conn.query(sql, [bio, birthday, country, phone, userID], (err) => {
        if (err) {
            console.log(err)
            console.error(err);
            return res.status(500).send("Error updating information.");
        }
        res.send("Information updated successfully.");
    });
});

module.exports = router;
