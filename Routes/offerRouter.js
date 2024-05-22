const express = require('express');
const offersController = require('../Controllers/offersController');

const router = express.Router();

router.post('/', offersController.createOffer);
router.get('/', offersController.getOffers);
router.get('/:offer_id', offersController.getOfferById);
router.patch('/:offer_id', offersController.updateOfferById);
router.delete('/:offer_id', offersController.deleteOfferById);


module.exports = router;
