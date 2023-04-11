<!-- ....................................................................... -->
<!-- MathML Qualified Names Module  ........................................ -->
<!-- file: mathml3-qname-1.mod

     This is the Mathematical Markup Language (MathML) 2.0, an XML 
     application for describing mathematical notation and capturing 
     both its structure and content.

     Copyright 1998-2010 W3C (MIT, INRIA, Keio), All Rights Reserved.

     This DTD module is identified by the PUBLIC and SYSTEM identifiers:

       PUBLIC "-//W3C//ENTITIES MathML 3.0 Qualified Names 1.0//EN"
       SYSTEM "mathml3-qname.mod"

     Revisions:
     (none)
     ....................................................................... -->

<!-- MathML Qualified Names

     This module is contained in two parts, labeled Section 'A' and 'B':

       Section A declares parameter entities to support namespace-
       qualified names, namespace declarations, and name prefixing 
       for MathML.
    
       Section B declares parameter entities used to provide
       namespace-qualified names for all MathML element types.

     This module is derived from the XHTML Qualified Names Template module.
-->

<!-- Section A: XHTML XML Namespace Framework :::::::::::::::::::: -->

<!ENTITY % NS.prefixed     "IGNORE" >
<!ENTITY % MATHML.prefixed "%NS.prefixed;" >

<!-- XLink ............... -->

<!ENTITY % XLINK.prefix         "xlink" >		
<!ENTITY % XLINK.xmlns "http://www.w3.org/1999/xlink" >
<!ENTITY % XLINK.xmlns.attrib
     "xmlns:%XLINK.prefix;  CDATA           #FIXED '%XLINK.xmlns;'"
>

<!-- W3C XML Schema ............... -->

<!ENTITY % Schema.prefix         "xsi" >		
<!ENTITY % Schema.xmlns "http://www.w3.org/2001/XMLSchema-instance" >
<!ENTITY % Schema.xmlns.attrib
     "xmlns:%Schema.prefix;  CDATA           #IMPLIED"
>

<!-- MathML .............. -->

<!ENTITY % MATHML.xmlns    "http://www.w3.org/1998/Math/MathML" >
<!ENTITY % MATHML.prefix   "m" >
<![%MATHML.prefixed;[
<!ENTITY % MATHML.xmlns.extra.attrib  "" >
]]>
<!ENTITY % MATHML.xmlns.extra.attrib 
     "%XLINK.xmlns.attrib; 
      %Schema.xmlns.attrib;" >

<![%MATHML.prefixed;[
<!ENTITY % MATHML.pfx  "%MATHML.prefix;:" >
<!ENTITY % MATHML.xmlns.attrib
     "xmlns:%MATHML.prefix;  CDATA   #FIXED '%MATHML.xmlns;'
      %MATHML.xmlns.extra.attrib;"
>
]]>
<!ENTITY % MATHML.pfx  "" >
<!ENTITY % MATHML.xmlns.attrib
     "xmlns        CDATA           #FIXED '%MATHML.xmlns;'
      %MATHML.xmlns.extra.attrib;"
>

<![%NS.prefixed;[
<!ENTITY % XHTML.xmlns.extra.attrib 
     "%MATHML.xmlns.attrib;" >
]]>
<!ENTITY % XHTML.xmlns.extra.attrib
     "%XLINK.xmlns.attrib;
      %Schema.xmlns.attrib;"
>


<!-- ignores subsequent instantiation of this module when
     used as external subset rather than module fragment.
     NOTE: Do not modify this parameter entity, otherwise
     a recursive parsing situation may result.
-->
<!ENTITY % mathml-qname.module "IGNORE" >

<!-- Section B: MathML Qualified Names ::::::::::::::::::::::::::::: -->

<!-- 9. This section declares parameter entities used to provide
        namespace-qualified names for all MathML element types.
-->

<!ENTITY % abs.qname "%MATHML.pfx;abs" >
<!ENTITY % and.qname "%MATHML.pfx;and" >
<!ENTITY % annotation-xml.qname "%MATHML.pfx;annotation-xml" >
<!ENTITY % annotation.qname "%MATHML.pfx;annotation" >
<!ENTITY % apply.qname "%MATHML.pfx;apply" >
<!ENTITY % approx.qname "%MATHML.pfx;approx" >
<!ENTITY % arccos.qname "%MATHML.pfx;arccos" >
<!ENTITY % arccosh.qname "%MATHML.pfx;arccosh" >
<!ENTITY % arccot.qname "%MATHML.pfx;arccot" >
<!ENTITY % arccoth.qname "%MATHML.pfx;arccoth" >
<!ENTITY % arccsc.qname "%MATHML.pfx;arccsc" >
<!ENTITY % arccsch.qname "%MATHML.pfx;arccsch" >
<!ENTITY % arcsec.qname "%MATHML.pfx;arcsec" >
<!ENTITY % arcsech.qname "%MATHML.pfx;arcsech" >
<!ENTITY % arcsin.qname "%MATHML.pfx;arcsin" >
<!ENTITY % arcsinh.qname "%MATHML.pfx;arcsinh" >
<!ENTITY % arctan.qname "%MATHML.pfx;arctan" >
<!ENTITY % arctanh.qname "%MATHML.pfx;arctanh" >
<!ENTITY % arg.qname "%MATHML.pfx;arg" >
<!ENTITY % bind.qname "%MATHML.pfx;bind" >
<!ENTITY % bvar.qname "%MATHML.pfx;bvar" >
<!ENTITY % card.qname "%MATHML.pfx;card" >
<!ENTITY % cartesianproduct.qname "%MATHML.pfx;cartesianproduct" >
<!ENTITY % cbytes.qname "%MATHML.pfx;cbytes" >
<!ENTITY % ceiling.qname "%MATHML.pfx;ceiling" >
<!ENTITY % cerror.qname "%MATHML.pfx;cerror" >
<!ENTITY % ci.qname "%MATHML.pfx;ci" >
<!ENTITY % cn.qname "%MATHML.pfx;cn" >
<!ENTITY % codomain.qname "%MATHML.pfx;codomain" >
<!ENTITY % complexes.qname "%MATHML.pfx;complexes" >
<!ENTITY % compose.qname "%MATHML.pfx;compose" >
<!ENTITY % condition.qname "%MATHML.pfx;condition" >
<!ENTITY % conjugate.qname "%MATHML.pfx;conjugate" >
<!ENTITY % cos.qname "%MATHML.pfx;cos" >
<!ENTITY % cosh.qname "%MATHML.pfx;cosh" >
<!ENTITY % cot.qname "%MATHML.pfx;cot" >
<!ENTITY % coth.qname "%MATHML.pfx;coth" >
<!ENTITY % cs.qname "%MATHML.pfx;cs" >
<!ENTITY % csc.qname "%MATHML.pfx;csc" >
<!ENTITY % csch.qname "%MATHML.pfx;csch" >
<!ENTITY % csymbol.qname "%MATHML.pfx;csymbol" >
<!ENTITY % curl.qname "%MATHML.pfx;curl" >
<!ENTITY % declare.qname "%MATHML.pfx;declare" >
<!ENTITY % degree.qname "%MATHML.pfx;degree" >
<!ENTITY % determinant.qname "%MATHML.pfx;determinant" >
<!ENTITY % diff.qname "%MATHML.pfx;diff" >
<!ENTITY % divergence.qname "%MATHML.pfx;divergence" >
<!ENTITY % divide.qname "%MATHML.pfx;divide" >
<!ENTITY % domain.qname "%MATHML.pfx;domain" >
<!ENTITY % domainofapplication.qname "%MATHML.pfx;domainofapplication" >
<!ENTITY % emptyset.qname "%MATHML.pfx;emptyset" >
<!ENTITY % eq.qname "%MATHML.pfx;eq" >
<!ENTITY % equivalent.qname "%MATHML.pfx;equivalent" >
<!ENTITY % eulergamma.qname "%MATHML.pfx;eulergamma" >
<!ENTITY % exists.qname "%MATHML.pfx;exists" >
<!ENTITY % exp.qname "%MATHML.pfx;exp" >
<!ENTITY % exponentiale.qname "%MATHML.pfx;exponentiale" >
<!ENTITY % factorial.qname "%MATHML.pfx;factorial" >
<!ENTITY % factorof.qname "%MATHML.pfx;factorof" >
<!ENTITY % false.qname "%MATHML.pfx;false" >
<!ENTITY % floor.qname "%MATHML.pfx;floor" >
<!ENTITY % fn.qname "%MATHML.pfx;fn" >
<!ENTITY % forall.qname "%MATHML.pfx;forall" >
<!ENTITY % gcd.qname "%MATHML.pfx;gcd" >
<!ENTITY % geq.qname "%MATHML.pfx;geq" >
<!ENTITY % grad.qname "%MATHML.pfx;grad" >
<!ENTITY % gt.qname "%MATHML.pfx;gt" >
<!ENTITY % ident.qname "%MATHML.pfx;ident" >
<!ENTITY % image.qname "%MATHML.pfx;image" >
<!ENTITY % imaginary.qname "%MATHML.pfx;imaginary" >
<!ENTITY % imaginaryi.qname "%MATHML.pfx;imaginaryi" >
<!ENTITY % implies.qname "%MATHML.pfx;implies" >
<!ENTITY % in.qname "%MATHML.pfx;in" >
<!ENTITY % infinity.qname "%MATHML.pfx;infinity" >
<!ENTITY % int.qname "%MATHML.pfx;int" >
<!ENTITY % integers.qname "%MATHML.pfx;integers" >
<!ENTITY % intersect.qname "%MATHML.pfx;intersect" >
<!ENTITY % interval.qname "%MATHML.pfx;interval" >
<!ENTITY % inverse.qname "%MATHML.pfx;inverse" >
<!ENTITY % lambda.qname "%MATHML.pfx;lambda" >
<!ENTITY % laplacian.qname "%MATHML.pfx;laplacian" >
<!ENTITY % lcm.qname "%MATHML.pfx;lcm" >
<!ENTITY % leq.qname "%MATHML.pfx;leq" >
<!ENTITY % limit.qname "%MATHML.pfx;limit" >
<!ENTITY % list.qname "%MATHML.pfx;list" >
<!ENTITY % ln.qname "%MATHML.pfx;ln" >
<!ENTITY % log.qname "%MATHML.pfx;log" >
<!ENTITY % logbase.qname "%MATHML.pfx;logbase" >
<!ENTITY % lowlimit.qname "%MATHML.pfx;lowlimit" >
<!ENTITY % lt.qname "%MATHML.pfx;lt" >
<!ENTITY % maction.qname "%MATHML.pfx;maction" >
<!ENTITY % maligngroup.qname "%MATHML.pfx;maligngroup" >
<!ENTITY % malignmark.qname "%MATHML.pfx;malignmark" >
<!ENTITY % math.qname "%MATHML.pfx;math" >
<!ENTITY % matrix.qname "%MATHML.pfx;matrix" >
<!ENTITY % matrixrow.qname "%MATHML.pfx;matrixrow" >
<!ENTITY % max.qname "%MATHML.pfx;max" >
<!ENTITY % mean.qname "%MATHML.pfx;mean" >
<!ENTITY % median.qname "%MATHML.pfx;median" >
<!ENTITY % menclose.qname "%MATHML.pfx;menclose" >
<!ENTITY % merror.qname "%MATHML.pfx;merror" >
<!ENTITY % mfenced.qname "%MATHML.pfx;mfenced" >
<!ENTITY % mfrac.qname "%MATHML.pfx;mfrac" >
<!ENTITY % mglyph.qname "%MATHML.pfx;mglyph" >
<!ENTITY % mi.qname "%MATHML.pfx;mi" >
<!ENTITY % min.qname "%MATHML.pfx;min" >
<!ENTITY % minus.qname "%MATHML.pfx;minus" >
<!ENTITY % mlabeledtr.qname "%MATHML.pfx;mlabeledtr" >
<!ENTITY % mlongdiv.qname "%MATHML.pfx;mlongdiv" >
<!ENTITY % mmultiscripts.qname "%MATHML.pfx;mmultiscripts" >
<!ENTITY % mn.qname "%MATHML.pfx;mn" >
<!ENTITY % mo.qname "%MATHML.pfx;mo" >
<!ENTITY % mode.qname "%MATHML.pfx;mode" >
<!ENTITY % moment.qname "%MATHML.pfx;moment" >
<!ENTITY % momentabout.qname "%MATHML.pfx;momentabout" >
<!ENTITY % mover.qname "%MATHML.pfx;mover" >
<!ENTITY % mpadded.qname "%MATHML.pfx;mpadded" >
<!ENTITY % mphantom.qname "%MATHML.pfx;mphantom" >
<!ENTITY % mprescripts.qname "%MATHML.pfx;mprescripts" >
<!ENTITY % mroot.qname "%MATHML.pfx;mroot" >
<!ENTITY % mrow.qname "%MATHML.pfx;mrow" >
<!ENTITY % ms.qname "%MATHML.pfx;ms" >
<!ENTITY % mscarries.qname "%MATHML.pfx;mscarries" >
<!ENTITY % mscarry.qname "%MATHML.pfx;mscarry" >
<!ENTITY % msgroup.qname "%MATHML.pfx;msgroup" >
<!ENTITY % msline.qname "%MATHML.pfx;msline" >
<!ENTITY % mspace.qname "%MATHML.pfx;mspace" >
<!ENTITY % msqrt.qname "%MATHML.pfx;msqrt" >
<!ENTITY % msrow.qname "%MATHML.pfx;msrow" >
<!ENTITY % mstack.qname "%MATHML.pfx;mstack" >
<!ENTITY % mstyle.qname "%MATHML.pfx;mstyle" >
<!ENTITY % msub.qname "%MATHML.pfx;msub" >
<!ENTITY % msubsup.qname "%MATHML.pfx;msubsup" >
<!ENTITY % msup.qname "%MATHML.pfx;msup" >
<!ENTITY % mtable.qname "%MATHML.pfx;mtable" >
<!ENTITY % mtd.qname "%MATHML.pfx;mtd" >
<!ENTITY % mtext.qname "%MATHML.pfx;mtext" >
<!ENTITY % mtr.qname "%MATHML.pfx;mtr" >
<!ENTITY % munder.qname "%MATHML.pfx;munder" >
<!ENTITY % munderover.qname "%MATHML.pfx;munderover" >
<!ENTITY % naturalnumbers.qname "%MATHML.pfx;naturalnumbers" >
<!ENTITY % neq.qname "%MATHML.pfx;neq" >
<!ENTITY % none.qname "%MATHML.pfx;none" >
<!ENTITY % not.qname "%MATHML.pfx;not" >
<!ENTITY % notanumber.qname "%MATHML.pfx;notanumber" >
<!ENTITY % notin.qname "%MATHML.pfx;notin" >
<!ENTITY % notprsubset.qname "%MATHML.pfx;notprsubset" >
<!ENTITY % notsubset.qname "%MATHML.pfx;notsubset" >
<!ENTITY % or.qname "%MATHML.pfx;or" >
<!ENTITY % otherwise.qname "%MATHML.pfx;otherwise" >
<!ENTITY % outerproduct.qname "%MATHML.pfx;outerproduct" >
<!ENTITY % partialdiff.qname "%MATHML.pfx;partialdiff" >
<!ENTITY % pi.qname "%MATHML.pfx;pi" >
<!ENTITY % piece.qname "%MATHML.pfx;piece" >
<!ENTITY % piecewise.qname "%MATHML.pfx;piecewise" >
<!ENTITY % plus.qname "%MATHML.pfx;plus" >
<!ENTITY % power.qname "%MATHML.pfx;power" >
<!ENTITY % primes.qname "%MATHML.pfx;primes" >
<!ENTITY % product.qname "%MATHML.pfx;product" >
<!ENTITY % prsubset.qname "%MATHML.pfx;prsubset" >
<!ENTITY % quotient.qname "%MATHML.pfx;quotient" >
<!ENTITY % rationals.qname "%MATHML.pfx;rationals" >
<!ENTITY % real.qname "%MATHML.pfx;real" >
<!ENTITY % reals.qname "%MATHML.pfx;reals" >
<!ENTITY % reln.qname "%MATHML.pfx;reln" >
<!ENTITY % rem.qname "%MATHML.pfx;rem" >
<!ENTITY % root.qname "%MATHML.pfx;root" >
<!ENTITY % scalarproduct.qname "%MATHML.pfx;scalarproduct" >
<!ENTITY % sdev.qname "%MATHML.pfx;sdev" >
<!ENTITY % sec.qname "%MATHML.pfx;sec" >
<!ENTITY % sech.qname "%MATHML.pfx;sech" >
<!ENTITY % selector.qname "%MATHML.pfx;selector" >
<!ENTITY % semantics.qname "%MATHML.pfx;semantics" >
<!ENTITY % sep.qname "%MATHML.pfx;sep" >
<!ENTITY % set.qname "%MATHML.pfx;set" >
<!ENTITY % setdiff.qname "%MATHML.pfx;setdiff" >
<!ENTITY % share.qname "%MATHML.pfx;share" >
<!ENTITY % sin.qname "%MATHML.pfx;sin" >
<!ENTITY % sinh.qname "%MATHML.pfx;sinh" >
<!ENTITY % subset.qname "%MATHML.pfx;subset" >
<!ENTITY % sum.qname "%MATHML.pfx;sum" >
<!ENTITY % tan.qname "%MATHML.pfx;tan" >
<!ENTITY % tanh.qname "%MATHML.pfx;tanh" >
<!ENTITY % tendsto.qname "%MATHML.pfx;tendsto" >
<!ENTITY % times.qname "%MATHML.pfx;times" >
<!ENTITY % transpose.qname "%MATHML.pfx;transpose" >
<!ENTITY % true.qname "%MATHML.pfx;true" >
<!ENTITY % union.qname "%MATHML.pfx;union" >
<!ENTITY % uplimit.qname "%MATHML.pfx;uplimit" >
<!ENTITY % variance.qname "%MATHML.pfx;variance" >
<!ENTITY % vector.qname "%MATHML.pfx;vector" >
<!ENTITY % vectorproduct.qname "%MATHML.pfx;vectorproduct" >
<!ENTITY % xor.qname "%MATHML.pfx;xor" >
