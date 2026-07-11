import { Router } from 'express';
import * as publicController from '../controllers/publicController.js';

const router = Router();

router.get('/site', publicController.getSite);
router.get('/listings/featured', publicController.getFeatured);
router.get('/testimonials', publicController.getTestimonials);
router.get('/listings', publicController.listListingsValidators, publicController.listListings);
router.get('/listings/:slug', publicController.getListing);
router.get('/agents', publicController.listAgents);
router.get('/agents/:slug', publicController.getAgent);
router.post('/inquiries', publicController.inquiryValidators, publicController.submitInquiry);

export default router;
