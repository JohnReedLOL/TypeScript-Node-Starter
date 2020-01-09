"use strict";

// I don't know if these all are necessary - I just copied them from user.ts
import async from "async";
import { Apartment, ApartmentDocument } from "../models/Apartment";
import { ApartmentBookings, ApartmentBookingsDocument } from "../models/ApartmentBookings";
import { Landlord, LandlordDocument } from "../models/Landlord";
import { Request, Response, NextFunction } from "express";
import { WriteError } from "mongodb";
import { check, sanitize, validationResult } from "express-validator";
import "../config/passport";
import { reduce } from "bluebird";

const addDaysToDate = (startDate: Date, days: number) => {
    const date = new Date(startDate.valueOf());
    date.setDate(date.getDate() + days);
    return date;
};

const getDates = (startDate: Date, stopDate: Date) => {
    const dateArray: Date[] = [];
    let currentDate = startDate;
    while (currentDate <= stopDate) {
        dateArray.push(new Date (currentDate));
        currentDate = addDaysToDate(currentDate, 1);
    }
    return dateArray;
};

/**
 * POST /search-for-apartments
 * This does the actual searching for apartments in the database
 */
export const postSearchForApartments = async (req: Request, res: Response, next: NextFunction) => {
    await check("numBedrooms", "numBedrooms must be a number").isNumeric().run(req);
    await check("numBathrooms", "numBathrooms must be a number").isNumeric().run(req);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.flash("errors", errors.array());
        return res.redirect("search-for-apartments");
    }
    const numBedrooms = parseFloat(req.body.numBedrooms);
    const numBathrooms = parseFloat(req.body.numBathrooms);
    const dateRange = req.body.dateRange;
    const splitDateRange = dateRange.split("-");
    const dateOneString = splitDateRange[0].trim();
    const dateTwotring = splitDateRange[1].trim();
    const bookedDates: Date[]  = getDates(new Date(dateOneString), new Date(dateTwotring));
    const bookedDatesTimes = new Set();
    for(let i = 0; i < bookedDates.length; ++i) {
        const bookedDate: Date = bookedDates[i];
        bookedDatesTimes.add(bookedDate.getTime());
    }
    const monthPrice = req.body.monthPrice.split(" ");
    const month = monthPrice[0].trim().toLowerCase();
    let price = monthPrice[1].trim();
    if(price.charAt(0) == "$") {
        price = price.substr(1);
    }
    const monthVariable = month + "Price";
    // Filter by numBathrooms, numBedrooms, and price for a given month now. Filter by dates booked later.
    Apartment.find({ numBathrooms: { $gte: numBathrooms }, numBedrooms: { $gte: numBedrooms },
        [monthVariable]: { $lte: price }}, (err, apartments: any) => {
        if (err) { return next(err); }
        const apartmentNumbers: number[] = [];
        for(let i = 0; i < apartments.length; ++i) {
            const apartment = apartments[i];
            apartmentNumbers.push(apartment.apartmentNumber);
        }
        const apartmentNumbersSet = new Set(apartmentNumbers);
        // Now we can filter by dates booked.
        ApartmentBookings.find({apartmentNumber: { $in: apartmentNumbers }}, (err, bookings: any) => {
            if (err) { return next(err); }
            // Filter out all the apartments whose dates are booked from the apartmentNumbersSet.
            for(const booking of bookings) {
                const bookingDate: Date = booking.eveningBooked;
                if(bookedDatesTimes.has(bookingDate.getTime())) {
                    apartmentNumbersSet.delete(booking.apartmentNumber);
                }
            }
            return res.render("apartment/apartmentsThatMatchSearch", {
                title: "Apartments That Match Your Search",
                apartmentNumbers: Array.from(apartmentNumbersSet)

            });
        });
    });
};

/**
 * GET /search-for-apartments
 * Page to let users search for apartments
 */
export const searchForApartments = (req: Request, res: Response) => {
    res.render("apartment/search", {
        title: "Search For Apartment"
    });
};

/**
 * POST /account/edit-listing/:apartmentNumber
 * Call to update listing for an apartment.
 */
export const postUpdateApartmentListing = async (req: Request, res: Response, next: NextFunction) => {
    const apartmentNumber = parseInt(req.params.apartmentNumber, 10);
    await check("apartmentNumber", "apartmentNumber must be a number").isNumeric().run(req);
    await check("numBedrooms", "numBedrooms must be a number").isNumeric().run(req);
    await check("numBathrooms", "numBathrooms must be a number").isNumeric().run(req);
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
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        req.flash("errors", errors.array());
        return res.redirect("account/edit-listing/" + apartmentNumber);
    }

    const filter = { apartmentNumber: parseInt(req.body.apartmentNumber, 10) };
    const user = req.user as LandlordDocument;
    const update = { 
        landlordEmail: user.email.toLowerCase(),
        numBedrooms: parseFloat(req.body.numBedrooms),
        numBathrooms: parseFloat(req.body.numBathrooms),
        photosFolder: req.body.photosFolder,
        januaryPrice: parseFloat(req.body.januaryPrice),
        februaryPrice: parseFloat(req.body.februaryPrice),
        marchPrice: parseFloat(req.body.marchPrice),
        aprilPrice: parseFloat(req.body.aprilPrice),
        mayPrice: parseFloat(req.body.mayPrice),
        junePrice: parseFloat(req.body.junePrice),
        julyPrice: parseFloat(req.body.julyPrice),
        augustPrice: parseFloat(req.body.augustPrice),
        septemberPrice: parseFloat(req.body.septemberPrice),
        octoberPrice: parseFloat(req.body.octoberPrice),
        novemberPrice: parseFloat(req.body.novemberPrice),
        decemberPrice: parseFloat(req.body.decemberPrice),
        additionalInformation: req.body.additionalInformation
    };

    await Apartment.findOneAndUpdate(filter, update);
    res.redirect("/account/update-listing");
};

/**
 * GET /account/edit-listing/:apartmentNumber
 * Page to update listing for an apartment.
 */
export const getUpdateApartmentListing = (req: Request, res: Response, next: NextFunction) => {
    const apartmentNumber = parseInt(req.params.apartmentNumber, 10);
    Apartment.find( {apartmentNumber: apartmentNumber}, (err, apartments: any) => {
        if (err) { return next(err); }
        res.render("apartment/update", {
            title: "Update Listing For Apartment #" + apartmentNumber,
            apartmentNumber: apartmentNumber,
            apartment: apartments[0]
        });
    });  
};

/**
 * GET /account/update-availability/:apartmentNumber
 * Book dates for an apartment
 */
export const updateApartmentAvailability = (req: Request, res: Response, next: NextFunction) => {
    const apartmentNumber = parseInt(req.params.apartmentNumber, 10);
    res.render("apartment/availability", {
        title: "Book Dates For Apartment #" + apartmentNumber,
        apartmentNumber: apartmentNumber
    });
};

/**
 * POST /account/update-availability/:apartmentNumber
 * Book dates for an apartment
 */
export const postUpdateApartmentAvailability = (req: Request, res: Response, next: NextFunction) => {
    const apartmentNumber = parseInt(req.params.apartmentNumber, 10);
    const dateRange = req.body.daterange;
    const splitDateRange = dateRange.split("-");
    const dateOneString = splitDateRange[0].trim();
    const dateTwotring = splitDateRange[1].trim();
    const dates: Date[]  = getDates(new Date(dateOneString), new Date(dateTwotring));
    const apartmentBookings = [];
    for(let i = 0; i < dates.length; ++i) {
        apartmentBookings.push({apartmentNumber : apartmentNumber, eveningBooked: dates[i]});
    } 
    ApartmentBookings.create(apartmentBookings, function (err: any, bookings: any) {
        if (err) { return next(err); }
        return res.render("apartment/bookedDays", {
            title: "The following evenings have been booked:",
            bookings: bookings
        });
    });
};

/**
 * GET /account/update-listing
 * Chose between updating the info for an apartment or updating its availability
 */
export const updateApartment = (req: Request, res: Response) => {
    const apartmentNumber = req.query.listing;
    if(apartmentNumber == undefined) {
        res.render("apartment/pickApartmentToEdit", {
            title: "Pick An Apartment Number To Edit",
        });
    } else {
        res.render("apartment/editListingOrAvailability", {
            title: "Update Listing Or Availability Of Apartment #" + apartmentNumber,
            apartmentNumber: apartmentNumber
        });
    }
};

/**
 * GET /apartment/:apartmentNumber
 * Listing page for an apartment.
 */
export const getApartment = (req: Request, res: Response, next: NextFunction) => {
    const apartmentNumber = parseInt(req.params.apartmentNumber, 10);

    Apartment.find( {apartmentNumber: apartmentNumber}, (err, apartments: any) => {
        if (err) { return next(err); }
        const myApartment = apartments[0];
            res.render("apartment/getByNumber", {
                title: "Apartment Number " + apartmentNumber,
                apt: myApartment
            });
    });
};

/**
 * GET /rent-apartment-by-landlord
 * Form to fill in the landlord. If landlord is filled, list the apartments.
 */
export const getRentApartmentByLandlord = (req: Request, res: Response, next: NextFunction) => {
    let landlord = req.query.landlord; // email address of landlord
    if(landlord == undefined) {
        res.render("apartment/getByLandlord", {
            title: "Get Apartments By Landlord"
        });
    } else {
        landlord = landlord.toLowerCase();
        Apartment.find({ landlordEmail: landlord}, (err, apartments: any) => {
            if (err) { return next(err); }
            res.render("apartment/apartmentsWithLandlord", {
                title: "Get Apartments By Landlord",
                landlordsEmail: landlord,
                apartments: apartments

            });
        });
    }
};

/**
 * GET /account/list-apartment
 * Page for a landlord to list an apartment.
 */
export const getCreateApartment = (req: Request, res: Response) => {
    res.render("apartment/create", {
        title: "List Apartment",
        apartment: {
            apartmentNumber: 0,
            numBedrooms: 0,
            numBathrooms: 0,
            photosFolder: "https://drive.google.com/open?id=1_QApdFQj3sT2OG8q2NCjbIz20A384auz",
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
    await check("numBedrooms", "numBedrooms must be a number").isNumeric().run(req);
    await check("numBathrooms", "numBathrooms must be a number").isNumeric().run(req);
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
        numBedrooms: 0,
        numBathrooms: 0,
        photosFolder: "", // Link to photos of your apartment on Google Drive
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
    apartment.landlordEmail = user.email.toLowerCase();
    apartment.numBedrooms = parseFloat(req.body.numBedrooms);
    apartment.numBathrooms = parseFloat(req.body.numBathrooms);
    apartment.photosFolder = req.body.photosFolder;
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
        // Note that I do not know if I have to look up user in the database and use that or if it's okay to just use req.user
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
