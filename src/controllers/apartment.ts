// I don't know if these all are necessary - I just copied them from user.ts
import async from "async";
import crypto from "crypto";
import nodemailer from "nodemailer";
import passport from "passport";
import { Landlord, LandlordDocument, AuthToken } from "../models/Landlord";
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
            januaryPrice: 0,
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
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        req.flash("errors", errors.array());
        return res.redirect("account/list-apartment");
    }

    const user = req.user as LandlordDocument;
    Landlord.findById(user.id, (err, user: LandlordDocument) => {
        if (err) { return next(err); }
        user.email = req.body.email || "";
        user.profile.name = req.body.name || "";
        user.profile.gender = req.body.gender || "";
        user.profile.location = req.body.location || "";
        user.profile.website = req.body.website || "";
        user.save((err: WriteError) => {
            if (err) {
                if (err.code === 11000) {
                    req.flash("errors", { msg: "The email address you have entered is already associated with an account." });
                    return res.redirect("/account");
                }
                return next(err);
            }
            req.flash("success", { msg: "Profile information has been updated." });
            res.redirect("/account");
        });
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