const mongoose = require('mongoose');
const Store = mongoose.model('Store');
const User = mongoose.model('User');
const multer = require('multer');
const jimp = require('jimp');
const uuid = require('uuid');

const multerOptions = {
    storage: multer.memoryStorage(), // write to memory
    fileFilter(req, file, next) {
        const isPhoto = file.mimetype.startsWith('image/');
        if (isPhoto) {
            next(null, true);
        } else {
            next({ message: 'That filetype isn\'t allowed'}, false);
        }
    }
}

exports.homePage = (req, res) => {
    res.render('index', {
        title: 'Store Front'
    });
};

exports.addStore = (req, res) => {
    res.render('editStore', {
        title: 'Add Store'
    });
};

exports.upload = multer(multerOptions).single('photo');

exports.resize = async (req, res, next) => {
    // check if there is no new file to resize
    if(!req.file) {
        next(); // skip to the next 
        return; // stop function from running
    }
    const extension = req.file.mimetype.split('/')[1];
    req.body.photo = `${uuid.v4()}.${extension}`;
    // now we resize
    const photo = await jimp.read(req.file.buffer);
    await photo.resize(800, jimp.AUTO);
    await photo.write(`./public/uploads/${req.body.photo}`);
    // after writing the image to our filesystem, we move!!!
    next();
}

exports.createStore = async (req, res) => {
    req.body.author = req.user._id;
    const store = await (new Store(req.body)).save();
    req.flash('success', `Successfully Created ${store.name}. Care to leave a review`);
    res.redirect(`/store/${store.slug}`);
};

exports.getStores = async (req, res) => {
    const page = req.params.page || 1;
    const limit = 4;
    const skip = (page * limit) - limit;
    // 1. Query Database for a list of all the stores
    // const stores = await Store.find().populate('reviews');
    const storesPromise = Store
        .find()
        .skip(skip)
        .limit(limit)
        .sort({ created: 'desc' });

    const countPromise = Store.count();

    const [stores, count] = await Promise.all([storesPromise, countPromise]);

    const pages = Math.ceil(count / limit);

    if (!stores.length && skip) {
        req.flash('info', `Hey! You asked for page ${page}. But that doesn't exist. So I put you on page ${pages}`);
        res.redirect(`/stores/page/${pages}`);
        return;
    }

    res.render('stores', {
        title: 'Stores', 
        stores,
        count,
        pages,
        page
    })
};

const confirmOwner = (store, user) => {
    if (!store.author.equals(user._id)) {
        throw Error('You must own a store in order to edit it');
    }
};

exports.editStore = async (req, res) => {
    // 1. find the store given the ID
    const store = await Store.findOne({ _id: req.params.id });

    // TODO 2. confirm they are the owner of the store
    confirmOwner(store, req.user);

    // 3. render out the edit form so the user can update store
    res.render('editStore', {
        title: `Edit ${store.name}`,
        store
    });
};

exports.updateStore = async (req, res) => {
    // set the location data to be a point
    req.body.location.type = 'Point';
    // find and update the store
    const store = await Store.findOneAndUpdate(
        { _id: req.params.id }, // query
        req.body, // data
        {
            new: true, // return new store instead of the old one
            runValidators: true
        }
    ).exec();

    req.flash('success', `Successfully updated <strong>${store.name}</strong>.
        <a href="/stores/${store.slug}">View Store</a>`);

    // redirect them to store
    res.redirect(`/stores/${store._id}/edit`);
};


exports.getStoreBySlug = async (req, res, next) => {
    // get the slug parameter
    const slug = req.params.slug;
    
    // find the store with the slug in db
    const store = await Store.findOne({ slug: slug }).populate('author reviews');

    if(!store) return next();

    res.render('store', {
        title: store.name,
        store
    });
}

exports.getStoresByTag = async (req, res) => {
    const tag = req.params.tag;
    const tagQuery = tag || { $exists: true }; // atleast a store with one tag on it
    const tagsPromise = Store.getTagsList();
    const storesPromise = Store.find({ tags: tagQuery });

    const [tags, stores] = await Promise.all([tagsPromise, storesPromise]);

    res.render('tag', { 
        tags, 
        title: 'Tags',
        tag,
        stores
    });
}

exports.searchStores = async (req, res) => {
    const stores = await Store
    // first find
    .find({
        $text: {
            $search: req.query.q,
        }
    }, {
        score: { $meta: 'textScore' }
    })
    // then sort
    .sort({
        score: { $meta: 'textScore' }
    })
    // then limit
    .limit(5);
    res.json(stores);
};

exports.mapStores = async (req, res) => {
    const coordinates = [req.query.lng, req.query.lat].map(parseFloat);
    const q = {
        location: {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: coordinates
                },
                // $maxDistance: 10000 // 10km
            }
        }
    };

    const stores = await Store.find(q).select('slug name description location photo').limit(10);
    res.json(stores);
};

exports.mapPage = (req, res) => {
    res.render('map', {
        title: 'Map'
    })
};

exports.heartStore = async (req, res) => {
    const hearts = req.user.hearts.map(obj => obj.toString());
    const operator = hearts.includes(req.param.id) ? '$pull' : '$addToSet';
    const user = await User
    .findByIdAndUpdate(req.user._id,
        { [operator]: { hearts: req.params.id } },
        { new: true }
    );
    res.json(user);
};

exports.getHearts = async (req, res) => {
    const stores = await Store.find({
        _id: { $in: req.user.hearts }
    });
    res.render('stores', { title: 'Hearted Stores', stores });
};

exports.getTopStores = async (req, res) => {
    const stores = await Store.getTopStores();
    res.render('topStores', {
        stores,
        title: 'Top Stores'
    })
};