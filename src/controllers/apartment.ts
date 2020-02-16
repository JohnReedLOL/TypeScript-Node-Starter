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

// Make sure each date range looks like "MM/DD/YYYY - MM/DD/YYYY"
const validateDateRange = (dateRange: string) => {
    const splitDateRange = dateRange.split("-");

    // Make sure date range has exactly one "-"
    if(splitDateRange.length != 2) {
        return false;
    }

    const dateOneString = splitDateRange[0].trim();
    const dateTwoString = splitDateRange[1].trim();

    // Make sure each date looks like "MM/DD/YYYY"
    const validateDate = (dateString: string) => {
        const dateStringSplit: string[] = dateString.split("/");
        if(dateStringSplit.length != 3) {
            return false;
        } else {
            // Make sure these are all numbers. Sorry for the ugly casing
            if( isNaN(dateStringSplit[0] as unknown as number)
                || isNaN(dateStringSplit[1] as unknown as number)
                || isNaN(dateStringSplit[2] as unknown as number) ) {
                return false;
            }
            const month = parseInt(dateStringSplit[0], 10);
            const day = parseInt(dateStringSplit[1], 10);
            const year = parseInt(dateStringSplit[2], 10);
            if(! (month >= 1 && month <= 12) ) {
                return false;
            }
            if(! (day >= 1 && day <= 31) ) {
                return false;
            }
            if(! (year >= 2020) ) {
                return false;
            }
        }
        return true;
    };

    const dateOneValid: boolean = validateDate(dateOneString);
    const dateTwoValid: boolean = validateDate(dateTwoString);
    if(dateOneValid && dateTwoValid) {
        return true;
    } else {
        return false;
    }
};

/**
 * POST /search-for-apartments
 * This does the actual searching for apartments in the database
 */
export const postSearchForApartments = async (req: Request, res: Response, next: NextFunction) => {
    await check("numBedrooms", "Number of bedrooms must be a number.").exists().isNumeric().run(req);
    await check("numBathrooms", "Number of bathrooms must be a number.").exists().isNumeric().run(req);
    await check("dateRange", "Date range must be in format: MM/DD/YYYY - MM/DD/YYYY.").exists()
    .custom( (dateRange: string) => {
        return validateDateRange(dateRange);
    }).run(req);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.flash("errors", errors.array());
        return res.redirect("/search-for-apartments");
    }

    const numBedrooms = parseFloat(req.body.numBedrooms);
    const numBathrooms = parseFloat(req.body.numBathrooms);
    const dateRange = req.body.dateRange;
    const splitDateRange = dateRange.split("-");
    const dateOneString = splitDateRange[0].trim();
    const dateTwoString = splitDateRange[1].trim();

    const bookedDates: Date[]  = getDates(new Date(dateOneString), new Date(dateTwoString));
    const bookedDatesTimes = new Set();
    for(let i = 0; i < bookedDates.length; ++i) {
        const bookedDate: Date = bookedDates[i];
        bookedDatesTimes.add(bookedDate.getTime());
    }
    // We are no longer filtering by price in a given month
    // const monthPrice = req.body.monthPrice.split(" ");
    // const month = monthPrice[0].trim().toLowerCase();
    // let price = monthPrice[1].trim();
    // if(price.charAt(0) == "$") {
    //     price = price.substr(1);
    // }
    // const monthVariable = month + "Price";
    // Filter by numBathrooms, numBedrooms, and price for a given month now. Filter by dates booked later.
    Apartment.find({ numBathrooms: { $gte: numBathrooms }, numBedrooms: { $gte: numBedrooms },
        }, (err, apartments: any) => {
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
            // Sort the apartments in descending order
            const nonBookedApartments: number[] = Array.from(apartmentNumbersSet).sort( (a, b) => {return b - a;} );
            return res.render("apartment/apartmentsThatMatchSearch", {
                title: "Apartments That Match Your Search",
                apartmentNumbers: nonBookedApartments
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
    await check("numBedrooms", "Number of bedrooms must be a number.").exists().isNumeric().run(req);
    await check("numBathrooms", "Number of bathrooms must be a number.").exists().isNumeric().run(req);
    // Prices can start with a dollar sign
    /*
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
    */
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        req.flash("errors", errors.array());
        return res.redirect("/account/edit-listing/" + apartmentNumber);
    }

    const filter = { apartmentNumber: apartmentNumber };
    const user = req.user as LandlordDocument;
    const update = { 
        landlordEmail: user.email.toLowerCase(),
        numBedrooms: parseFloat(req.body.numBedrooms),
        numBathrooms: parseFloat(req.body.numBathrooms),
        photosFolder: req.body.photosFolder,
        januaryPrice: parseFloat(req.body.januaryPrice.replace("$", "")), // ignore the dollar sign
        februaryPrice: parseFloat(req.body.februaryPrice.replace("$", "")),
        marchPrice: parseFloat(req.body.marchPrice.replace("$", "")),
        aprilPrice: parseFloat(req.body.aprilPrice.replace("$", "")),
        mayPrice: parseFloat(req.body.mayPrice.replace("$", "")),
        junePrice: parseFloat(req.body.junePrice.replace("$", "")),
        julyPrice: parseFloat(req.body.julyPrice.replace("$", "")),
        augustPrice: parseFloat(req.body.augustPrice.replace("$", "")),
        septemberPrice: parseFloat(req.body.septemberPrice.replace("$", "")),
        octoberPrice: parseFloat(req.body.octoberPrice.replace("$", "")),
        novemberPrice: parseFloat(req.body.novemberPrice.replace("$", "")),
        decemberPrice: parseFloat(req.body.decemberPrice.replace("$", "")),
        additionalInformation: req.body.additionalInformation
    };

    Apartment.findOneAndUpdate(filter, update, (err, doc: any) => {
        if (err) { return next(err); }
        req.flash("success", { msg: "Success! Your listing has been updated." });
        res.redirect("/apartment/" + apartmentNumber);
    });
};

/**
 * GET /account/edit-listing/:apartmentNumber
 * Page to update listing for an apartment.
 */
export const getUpdateApartmentListing = (req: Request, res: Response, next: NextFunction) => {
    const apartmentNumber = parseInt(req.params.apartmentNumber, 10);
    Apartment.findOne( {apartmentNumber: apartmentNumber}, (err, apartment: any) => {
        if (err) { return next(err); }
        res.render("apartment/update", {
            title: "Update Listing For Apartment #" + apartmentNumber,
            apartmentNumber: apartmentNumber,
            apartment: apartment
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
export const postUpdateApartmentAvailability = async (req: Request, res: Response, next: NextFunction) => {

    await check("dateRange", "Date range must be in format: MM/DD/YYYY - MM/DD/YYYY.").exists()
    .custom( (dateRange: string) => {
        return validateDateRange(dateRange);
    }).run(req);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.flash("errors", errors.array());
        return res.redirect("/account/update-availability/" + req.params.apartmentNumber);
    }

    const apartmentNumber = parseInt(req.params.apartmentNumber, 10);
    const dateRange = req.body.dateRange;

    const splitDateRange = dateRange.split("-");
    const dateOneString = splitDateRange[0].trim();
    const dateTwoString = splitDateRange[1].trim();
    const firstDate = new Date(dateOneString);
    const secondDate = new Date(dateTwoString);
    if(firstDate.getTime() > secondDate.getTime()) {
        return next("Looks like your first date is greater than your second date. Hit the back button and try again.");
    }

    const dates: Date[]  = getDates(firstDate, secondDate);
    const apartmentBookings = [];
    for(let i = 0; i < dates.length; ++i) {
        apartmentBookings.push({apartmentNumber : apartmentNumber, eveningBooked: dates[i]});
    } 
    ApartmentBookings.create(apartmentBookings, function (err: any, bookings: any) {
        if (err) { return next("Looks like you tried to book a day that was already booked. It's not a problem - just hit the back button."); }
        return res.render("apartment/bookedDays", {
            title: "The following evenings have been booked:",
            bookings: bookings
        });
    });
};

/**
 * POST /account/unupdate-availability/:apartmentNumber
 * Unbook dates for an apartment
 */
export const postUnUpdateApartmentAvailability = async (req: Request, res: Response, next: NextFunction) => {

    await check("dateRange2", "Date range must be in format: MM/DD/YYYY - MM/DD/YYYY.").exists()
    .custom( (dateRange: string) => {
        return validateDateRange(dateRange);
    }).run(req);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.flash("errors", errors.array());
        return res.redirect("/account/update-availability/" + req.params.apartmentNumber);
    }

    const apartmentNumber = parseInt(req.params.apartmentNumber, 10);

    const dateRange = req.body.dateRange2;
    const splitDateRange = dateRange.split("-");
    const dateOneString = splitDateRange[0].trim();
    const dateTwoString = splitDateRange[1].trim();
    const firstDate = new Date(dateOneString);
    const secondDate = new Date(dateTwoString);
    if(firstDate.getTime() > secondDate.getTime()) {
        return next("Looks like your first date is greater than your second date. Hit the back button and try again.");
    }

    const dates: Date[]  = getDates(firstDate, secondDate);

    ApartmentBookings.deleteMany({ apartmentNumber : apartmentNumber, eveningBooked: { $in: dates} }, function(err: any) {
        if (err) { return next(err); }
        return res.render("apartment/unbookedDays", {
            title: "The following evenings have been unbooked:",
            bookings: dates
        });
    });
};

/**
 * GET /account/update-listing
 * See your listings to chose one to update.
 */
export const chooseListingToUpdate = (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as LandlordDocument;
    const landlordEMail = user.email.toLowerCase();
    // select only the Apartment's apartmentNumber.
    Apartment.find({ landlordEmail: landlordEMail}, "apartmentNumber", (err, apartments: any) => {
        if (err) { return next(err); }
        res.render("apartment/pickApartmentToEdit", {
            title: "Pick An Apartment Number To Edit",
            apartments: apartments
        });
    });
};

/**
 * GET /account/update-listing/:apartmentNumber
 * Chose between updating the info for an apartment or updating its availability.
 */
export const updateListing = (req: Request, res: Response) => {
    const apartmentNumber = parseInt(req.params.apartmentNumber, 10);
    res.render("apartment/editListingOrAvailability", {
        title: "Update Listing Or Availability Of Apartment #" + apartmentNumber,
        apartmentNumber: apartmentNumber
    });
};

/**
 * GET /apartment/:apartmentNumber
 * Listing page for an apartment.
 */
export const getApartment = (req: Request, res: Response, next: NextFunction) => {
    const apartmentNumber = parseInt(req.params.apartmentNumber, 10);

    Apartment.findOne( {apartmentNumber: apartmentNumber}, (err, apartment: any) => {
        if (err) { return next(err); }
        res.render("apartment/getByNumber", {
            title: "Apartment Number " + apartmentNumber,
            apt: apartment
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
        // select only the Apartment's apartmentNumber.
        Apartment.find({ landlordEmail: landlord}, "apartmentNumber", (err, apartments: any) => {
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
    await check("apartmentNumber", "Apartment number must be a number.").exists().isNumeric().run(req);
    await check("numBedrooms", "Number of bedrooms must be a number.").exists().isNumeric().run(req);
    await check("numBathrooms", "Number of bathrooms must be a number.").exists().isNumeric().run(req);
    /*
    Prices can contain a dollar sign
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
    */
    const errors = validationResult(req); // user local variable has .apartments: CoreMongoseArray(0)

    if (!errors.isEmpty()) { // apartment-number, april-price, etc stored in req.body
        req.flash("errors", errors.array());
        return res.redirect("/account/list-apartment");
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
    apartment.januaryPrice = parseFloat(req.body.januaryPrice.replace("$", ""));
    apartment.februaryPrice = parseFloat(req.body.februaryPrice.replace("$", ""));
    apartment.marchPrice = parseFloat(req.body.marchPrice.replace("$", ""));
    apartment.aprilPrice = parseFloat(req.body.aprilPrice.replace("$", ""));
    apartment.mayPrice = parseFloat(req.body.mayPrice.replace("$", ""));
    apartment.junePrice = parseFloat(req.body.junePrice.replace("$", ""));
    apartment.julyPrice = parseFloat(req.body.julyPrice.replace("$", ""));
    apartment.augustPrice = parseFloat(req.body.augustPrice.replace("$", ""));
    apartment.septemberPrice = parseFloat(req.body.septemberPrice.replace("$", ""));
    apartment.octoberPrice = parseFloat(req.body.octoberPrice.replace("$", ""));
    apartment.novemberPrice = parseFloat(req.body.novemberPrice.replace("$", ""));
    apartment.decemberPrice = parseFloat(req.body.decemberPrice.replace("$", ""));
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
