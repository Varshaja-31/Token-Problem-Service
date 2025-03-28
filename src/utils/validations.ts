import * as Yup from 'yup';

export const TokenSchema = Yup.object().shape({
    token: Yup.string().required('Token is required.'),
});