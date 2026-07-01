declare module 'flutterwave-node-v3' {
  interface FlutterwaveConfig {
    clientId: string;
    clientSecret: string;
  }

  interface Customer {
    email: string;
    name: string;
  }

  interface Customizations {
    title: string;
    description: string;
  }

  interface PaymentLinkPayload {
    tx_ref: string;
    amount: number;
    currency: string;
    redirect_url: string;
    customer: Customer;
    customizations?: Customizations;
  }

  interface PaymentLinkResponse {
    status: string;
    message: string;
    data?: {
      link: string;
      redirect_url: string;
    };
  }

  interface TransactionVerifyPayload {
    id: string;
  }

  interface TransactionVerifyData {
    status: string;
    amount: number;
    currency: string;
    tx_ref: string;
    id: number;
    flw_ref: string;
    customer: Customer;
    meta?: {
      authorizer: string;
    };
  }

  interface TransactionVerifyResponse {
    status: string;
    message: string;
    data?: TransactionVerifyData;
  }

  interface PaymentLink {
    create(payload: PaymentLinkPayload): Promise<PaymentLinkResponse>;
  }

  interface Transaction {
    verify(payload: TransactionVerifyPayload): Promise<TransactionVerifyResponse>;
  }

  interface Encrypt {
    encryptData(data: string, encryptionKey: string): string;
    decryptData(encryptedData: string, encryptionKey: string): string;
  }

  class Flutterwave {
    constructor(clientId: string, clientSecret: string);
    PaymentLink: PaymentLink;
    Transaction: Transaction;
    Encrypt: Encrypt;
  }

  export default Flutterwave;
}
