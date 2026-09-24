const express = require('express');
const router = express.Router();
const geocodingController = require('../controllers/geocoding.controller');

router.get('/geocode', geocodingController.geocode);
router.get('/reverse', geocodingController.reverseGeocode);

module.exports = router;
