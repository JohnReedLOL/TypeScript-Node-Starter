import mongoose from "mongoose";

export type ApartmentDocument = mongoose.Document & {
    apartmentNumber: number;
    landlordEmail: string;

    // Only store if apartment is booked for a specific date. Otherwise, not booked.
    eveningsBooked: Date[];

    // Only store the price per month, not per day. Landlords can negotiate for specific days.
    januaryPrice: number;
    februaryPrice: number;
    marchPrice: number;
    aprilPrice: number;
    mayPrice: number;
    junePrice: number;
    julyPrice: number;
    augustPrice: number;
    septemberPrice: number;
    octoberPrice: number;
    novemberPrice: number;
    decemberPrice: number;

    // Landlorded provided additional information
    additionalInformation: string;
};

const apartmentSchema = new mongoose.Schema({
    apartmentNumber: { type: Number, unique: true },
    landlordEmail: String,
    eveningsBooked: Array,

    // Only store the price per month, not per day. Landlords can negotiate for specific days.
    januaryPrice: Number,
    februaryPrice: Number,
    marchPrice: Number,
    aprilPrice: Number,
    mayPrice: Number,
    junePrice: Number,
    julyPrice: Number,
    augustPrice: Number,
    septemberPrice: Number,
    octoberPrice: Number,
    novemberPrice: Number,
    decemberPrice: Number,

    additionalInformation: String
}, { timestamps: true });

export const Apartment = mongoose.model<ApartmentDocument>("Apartment", apartmentSchema);
