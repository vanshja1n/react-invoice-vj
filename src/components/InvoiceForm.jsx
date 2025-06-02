import React, { useState, useEffect, useCallback } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Card from "react-bootstrap/Card";
import InvoiceItem from "./InvoiceItem";
import InvoiceModal from "./InvoiceModal";
import InputGroup from "react-bootstrap/InputGroup";


const InvoiceForm = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currency, setCurrency] = useState("₹");
  const [currentDate, setCurrentDate] = useState(new Date().toLocaleDateString());
  const [invoiceNumber, setInvoiceNumber] = useState(1);
  const [dateOfIssue, setDateOfIssue] = useState("");
  const [billTo, setBillTo] = useState("");
  const [billToEmail, setBillToEmail] = useState("");
  const [billToAddress, setBillToAddress] = useState("");
  const [billFrom, setBillFrom] = useState("");
  const [billFromEmail, setBillFromEmail] = useState("");
  const [billFromAddress, setBillFromAddress] = useState("");
  const [notes, setNotes] = useState("Have a  great day!");
  const [total, setTotal] = useState("0.00");
  const [subTotal, setSubTotal] = useState("0.00");
  const [taxRate, setTaxRate] = useState("");
  const [taxAmount, setTaxAmount] = useState("0.00");
  const [discountRate, setDiscountRate] = useState("");
  const [discountAmount, setDiscountAmount] = useState("0.00");

  const [items, setItems] = useState([
    {
      id: (+new Date() + Math.floor(Math.random() * 999999)).toString(36),
      name: "",
      description: "",
      price: "1.00",
      quantity: 1,
    },
  ]);

  const handleCalculateTotal = useCallback(() => {
    let newSubTotal = items
      .reduce((acc, item) => acc + parseFloat(item.price) * parseInt(item.quantity), 0)
      .toFixed(2);

    let newTaxAmount = (newSubTotal * (taxRate / 100)).toFixed(2);
    let newDiscountAmount = (newSubTotal * (discountRate / 100)).toFixed(2);
    let newTotal = (newSubTotal - newDiscountAmount + parseFloat(newTaxAmount)).toFixed(2);

    setSubTotal(newSubTotal);
    setTaxAmount(newTaxAmount);
    setDiscountAmount(newDiscountAmount);
    setTotal(newTotal);
  }, [items, taxRate, discountRate]);

  useEffect(() => {
    handleCalculateTotal();
  }, [handleCalculateTotal]);

  const handleRowDel = (item) => {
    const updatedItems = items.filter((i) => i.id !== item.id);
    setItems(updatedItems);
  };

  const handleAddEvent = () => {
    const id = (+new Date() + Math.floor(Math.random() * 999999)).toString(36);
    const newItem = { id, name: "", price: "1.00", description: "", quantity: 1 };
    setItems([...items, newItem]);
  };

  const onItemizedItemEdit = (evt) => {
    const { id, name, value } = evt.target;
    const updatedItems = items.map((item) => item.id === id ? { ...item, [name]: value } : item);
    setItems(updatedItems);
  };

  const handleChange = (setter) => (event) => {
    setter(event.target.value);
    handleCalculateTotal();
  };

  const openModal = (event) => {
    event.preventDefault();
    handleCalculateTotal();
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  return (
    <Form onSubmit={openModal} className="bg-light p-4 rounded shadow-sm">
      <Row>
        <Col md={8} lg={9}>
          <Card className="p-4 p-xl-5 my-3 my-xl-4 shadow-sm border-0">
            <div className="d-flex flex-row align-items-start justify-content-between mb-3">
              <div className="d-flex flex-column">
                <div className="mb-2">
                  <span className="fw-bold text-muted">Current Date:&nbsp;</span>
                  <span className="text-dark fw-semibold">{currentDate}</span>
                </div>
                <div className="d-flex flex-row align-items-center">
                  <span className="fw-bold text-muted me-2">Due Date:</span>
                  <Form.Control
                    type="date"
                    value={dateOfIssue}
                    name="dateOfIssue"
                    onChange={handleChange(setDateOfIssue)}
                    style={{ maxWidth: "150px" }}
                    required
                  />
                </div>
              </div>
              <div className="d-flex flex-row align-items-center">
                <span className="fw-bold text-muted me-2">Invoice Number:</span>
                <Form.Control
                  type="number"
                  value={invoiceNumber}
                  name="invoiceNumber"
                  onChange={handleChange(setInvoiceNumber)}
                  min="1"
                  style={{ maxWidth: "70px" }}
                  required
                />
              </div>
            </div>
            <hr className="my-4" />
            <Row className="mb-5">
              <Col>
                <Form.Label className="fw-bold">Bill from:</Form.Label>
                <Form.Control placeholder="Your name or company" value={billFrom} type="text" className="my-2" onChange={handleChange(setBillFrom)} required />
                <Form.Control placeholder="Email address" value={billFromEmail} type="email" className="my-2" onChange={handleChange(setBillFromEmail)} required />
                <Form.Control placeholder="Billing address" value={billFromAddress} type="text" className="my-2" onChange={handleChange(setBillFromAddress)} required />
              </Col>
              <Col>
                <Form.Label className="fw-bold">Bill to:</Form.Label>
                <Form.Control placeholder="Client's name or company" value={billTo} type="text" className="my-2" onChange={handleChange(setBillTo)} required />
                <Form.Control placeholder="Email address" value={billToEmail} type="email" className="my-2" onChange={handleChange(setBillToEmail)} required />
                <Form.Control placeholder="Billing address" value={billToAddress} type="text" className="my-2" onChange={handleChange(setBillToAddress)} required />
              </Col>
            </Row>
            <InvoiceItem onItemizedItemEdit={onItemizedItemEdit} onRowAdd={handleAddEvent} onRowDel={handleRowDel} currency={currency} items={items} />
            <Row className="mt-4 justify-content-end">
              <Col lg={6}>
                <div className="d-flex justify-content-between py-1"><span className="fw-bold">Subtotal:</span><span>{currency}{subTotal}</span></div>
                <div className="d-flex justify-content-between py-1"><span className="fw-bold">Discount:</span><span><small>({discountRate || 0}%)</small> {currency}{discountAmount}</span></div>
                <div className="d-flex justify-content-between py-1"><span className="fw-bold">Tax:</span><span><small>({taxRate || 0}%)</small> {currency}{taxAmount}</span></div>
                <hr />
                <div className="d-flex justify-content-between fs-5 fw-bold"><span>Total:</span><span>{currency}{total}</span></div>
              </Col>
            </Row>
            <hr className="my-4" />
            <Form.Label className="fw-bold">Notes:</Form.Label>
            <Form.Control placeholder="Have a great day!" name="notes" value={notes} onChange={handleChange(setNotes)} as="textarea" className="my-2" rows={2} />
          </Card>
        </Col>
        <Col md={4} lg={3}>
          <div className="sticky-top pt-md-3 pt-xl-4">
            <InvoiceModal showModal={isOpen} closeModal={closeModal} info={{ dateOfIssue, invoiceNumber, billTo, billToEmail, billToAddress, billFrom, billFromEmail, billFromAddress, notes }} items={items} currency={currency} subTotal={subTotal} taxAmount={taxAmount} discountAmount={discountAmount} total={total} />
            <Form.Group className="mb-3">
              <Form.Label className="fw-bold">Currency:</Form.Label>
              <Form.Select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="my-1"
              >
                <option value="₹">INR (Indian Rupee)</option>
                <option value="$">USD (United States Dollar)</option>
                <option value="£">GBP (British Pound Sterling)</option>
                <option value="¥">JPY (Japanese Yen)</option>
                <option value="C$">CAD (Canadian Dollar)</option>
                <option value="A$">AUD (Australian Dollar)</option>
                <option value="S$">SGD (Singapore Dollar)</option>
                <option value="CN¥">CNY (Chinese Renminbi)</option>
                <option value="₿">BTC (Bitcoin)</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="my-3">
              <Form.Label className="fw-bold">Tax rate:</Form.Label>
              <InputGroup className="my-1 flex-nowrap">
                <Form.Control name="taxRate" type="number" value={taxRate} onChange={handleChange(setTaxRate)} className="bg-white border" placeholder="0.0" min="0.00" step="0.01" max="100.00" />
                <InputGroup.Text className="bg-light fw-bold text-secondary small">%</InputGroup.Text>
              </InputGroup>
            </Form.Group>
            <Form.Group className="my-3">
              <Form.Label className="fw-bold">Discount rate:</Form.Label>
              <InputGroup className="my-1 flex-nowrap">
                <Form.Control name="discountRate" type="number" value={discountRate} onChange={handleChange(setDiscountRate)} className="bg-white border" placeholder="0.0" min="0.00" step="0.01" max="100.00" />
                <InputGroup.Text className="bg-light fw-bold text-secondary small">%</InputGroup.Text>
              </InputGroup>
            </Form.Group>
            <hr className="mt-4 mb-3" />
            <Button variant="primary" type="submit" className="w-100">Review Invoice</Button>
          </div>
        </Col>
      </Row>
    </Form>
  );
};

export default InvoiceForm;
