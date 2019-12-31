// I don't know if these all are necessary - I just copied them from user.ts
import async from "async";
import crypto from "crypto";
import nodemailer from "nodemailer";
import passport from "passport";
import { Apartment, ApartmentDocument } from "../models/Apartment";
import { Landlord, LandlordDocument } from "../models/Landlord";
import { Request, Response, NextFunction } from "express";
import { IVerifyOptions } from "passport-local";
import { WriteError } from "mongodb";
import { check, sanitize, validationResult } from "express-validator";
import "../config/passport";

/*
app.get('/', function (req, res) {
    res.render('index', { title: 'Hey', message: 'Hello there!'});
});

html
   head
   title= title
body
   h1= message
*/

/**
 * GET /account/list-apartment
 * Page for a landlord to list an apartment.
 */
export const getCreateApartment = (req: Request, res: Response) => {
    res.render("apartment/create", {
        title: "List Apartment",
        apartment: {
            apartmentNumber: 0,
            additionalInformation: "",
            januaryPrice: 0, // These don't need to be sent in - the form can just be filled with empty string.
            februaryPrice: 0,
            marchPrice: 0,
            aprilPrice: 0,
            mayPrice: 0,
            junePrice: 0,
            julyPrice: 0,
            augustPrice: 0,
            septemberPrice: 0,
            octoberPrice: 0,
            novemberPrice: 0,
            decemberPrice: 0
        }
    });
};

/**
 * POST /account/list-apartment
 * Create landlord's apartment.
 */
export const postCreateApartment = async (req: Request, res: Response, next: NextFunction) => {
    await check("apartmentNumber", "apartmentNumber must be a number").isNumeric().run(req);
    await check("januaryPrice", "januaryPrice must be a number").isNumeric().run(req);
    await check("februaryPrice", "februaryPrice must be a number").isNumeric().run(req);
    await check("marchPrice", "marchPrice must be a number").isNumeric().run(req);
    await check("aprilPrice", "aprilPrice must be a number").isNumeric().run(req);
    await check("mayPrice", "mayPrice must be a number").isNumeric().run(req);
    await check("junePrice", "junePrice must be a number").isNumeric().run(req);
    await check("julyPrice", "julyPrice must be a number").isNumeric().run(req);
    await check("augustPrice", "augustPrice must be a number").isNumeric().run(req);
    await check("septemberPrice", "septemberPrice must be a number").isNumeric().run(req);
    await check("octoberPrice", "octoberPrice must be a number").isNumeric().run(req);
    await check("novemberPrice", "novemberPrice must be a number").isNumeric().run(req);
    await check("decemberPrice", "decemberPrice must be a number").isNumeric().run(req);
    const errors = validationResult(req); // user local variable has .apartments: CoreMongoseArray(0)

    if (!errors.isEmpty()) { // apartment-number, april-price, etc stored in req.body
        req.flash("errors", errors.array());
        return res.redirect("account/list-apartment");
    } // body.additional-information: "AdditionInfoRow1 111\r\nAdditionInfoRow2 222"

    const apartment = new Apartment({
        apartmentNumber: 0,
        landlordEmail: "",
        eveningsBooked: [],
        januaryPrice: 0, // These don't need to be sent in - the form can just be filled with empty string.
        februaryPrice: 0,
        marchPrice: 0,
        aprilPrice: 0,
        mayPrice: 0,
        junePrice: 0,
        julyPrice: 0,
        augustPrice: 0,
        septemberPrice: 0,
        octoberPrice: 0,
        novemberPrice: 0,
        decemberPrice: 0,
        additionalInformation: "",
    });

    const user = req.user as LandlordDocument;
    apartment.apartmentNumber = parseInt(req.body.apartmentNumber, 10);
    apartment.landlordEmail = user.email;
    apartment.januaryPrice = parseFloat(req.body.januaryPrice);
    apartment.februaryPrice = parseFloat(req.body.februaryPrice);
    apartment.marchPrice = parseFloat(req.body.marchPrice);
    apartment.aprilPrice = parseFloat(req.body.aprilPrice);
    apartment.mayPrice = parseFloat(req.body.mayPrice);
    apartment.junePrice = parseFloat(req.body.junePrice);
    apartment.julyPrice = parseFloat(req.body.julyPrice);
    apartment.augustPrice = parseFloat(req.body.augustPrice);
    apartment.septemberPrice = parseFloat(req.body.septemberPrice);
    apartment.octoberPrice = parseFloat(req.body.octoberPrice);
    apartment.novemberPrice = parseFloat(req.body.novemberPrice);
    apartment.decemberPrice = parseFloat(req.body.decemberPrice);
    apartment.additionalInformation = req.body.additionalInformation;
    apartment.save((err: WriteError) => {
        if (err) {
            if (err.code === 11000) { // If apartment number already exists err = MongoError: E11000 duplicate key error collection: test.apartments index: apartmentNumber_1 dup key: { : 8 }
                req.flash("errors", { msg: "The apartment number you have entered already exists in the database." });
                return res.redirect("/account/list-apartment");
            }
            return next(err);
        }
        // In addition to saving the apartment to the database, you must also update the Landlord with the link to their apartment.
        const newlyListedAppartment = {apartmentNumber: apartment.apartmentNumber};
        user.apartments.push(newlyListedAppartment);
        user.save((err: WriteError) => {
            if (err) { return next(err); }
        });
        // Done updating Landlord
        req.flash("success", { msg: "Apartment " + apartment.apartmentNumber + " has been listed. Try pulling up this apartment or updating its availability." });
        res.redirect("/");
    });
};

/**
 * GET /login
 * Login page.
 */ /*
export const getCreateApartment = (req: Request, res: Response) => {
    if (req.user) {
        return res.redirect("/");
    }
    res.render("account/login", {
        title: "Login"
    });
};*/

/**
 * POST /login
 * Sign in using email and password.
 */ /*
export const postCreateApartment = async (req: Request, res: Response, next: NextFunction) => {
    await check("email", "Email is not valid").isEmail().run(req);
    await check("password", "Password cannot be blank").isLength({min: 1}).run(req);
    // eslint-disable-next-line @typescript-eslint/camelcase
    await sanitize("email").normalizeEmail({ gmail_remove_dots: false }).run(req);

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        req.flash("errors", errors.array());
        return res.redirect("/login");
    }

    passport.authenticate("local", (err: Error, user: LandlordDocument, info: IVerifyOptions) => {
        if (err) { return next(err); }
        if (!user) {
            req.flash("errors", {msg: info.message});
            return res.redirect("/login");
        }
        req.logIn(user, (err) => {
            if (err) { return next(err); }
            req.flash("success", { msg: "Success! You are logged in." });
            res.redirect(req.session.returnTo || "/");
        });
    })(req, res, next);
}; */